import db from "@/server/db";
import { accounts, txnEntries, txnLines, valuationSnapshots } from "@/server/db/schema";
import {
  computeAccountSummaryById,
  type AccountSummaryItem,
} from "@/server/services/accounts-ledger/accounts";
import { convert, type FxSnapshotInfo } from "@/server/services/fx/provider";
import { logAudit } from "@/server/services/audit";
import { writeOutboxEventSync } from "@/server/services/outbox";
import { desc, eq, sql } from "drizzle-orm";

export async function getAccountSummary(id: string) {
  const summary = await computeAccountSummaryById({ accountId: id });
  return summary as AccountSummaryItem | null;
}

export async function postDeposit(
  input: {
    accountId: string;
    amount: number;
    occurredAt: string;
    note?: string;
    attachmentUrl?: string;
  },
  options: { tx?: typeof db } = {},
) {
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, input.accountId))
    .limit(1);
  if (!account) throw new Error("Account not found");
  if ((account.status ?? "ACTIVE") === "ARCHIVED") {
    throw new Error("account is archived");
  }
  const depositAmount = Number(input.amount);
  if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
    throw new Error("invalid amount");
  }
  const occurredAtDate = new Date(input.occurredAt);
  if (Number.isNaN(occurredAtDate.getTime())) {
    throw new Error("invalid occurredAt");
  }
  const attachment =
    typeof input.attachmentUrl === "string" &&
    input.attachmentUrl.trim().length > 0
      ? input.attachmentUrl.trim()
      : undefined;
  const performDeposit = (tx: typeof db) => {
    const lineInput = {
      accountId: input.accountId,
      type: "DEPOSIT",
      amount: String(depositAmount),
      currency: account.baseCurrency,
      fxSnapshotId: null,
      fxAppliedRate: "1",
      fxEffectiveAt: occurredAtDate,
      principalDelta: String(depositAmount),
      valuationDelta: String(depositAmount),
      note: input.note,
      attachmentUrl: attachment,
    };
    const createdEntry = tx
      .insert(txnEntries)
      .values({
        userId: account.userId,
        type: "DEPOSIT",
        occurredAt: occurredAtDate,
        fxSnapshotId: null,
        fxAppliedRate: "1",
        note: input.note,
      })
      .returning()
      .get();
    if (!createdEntry) {
      throw new Error("ledger_entry_create_failed");
    }
    const createdLine = tx
      .insert(txnLines)
      .values({ ...lineInput, entryId: createdEntry.id })
      .returning()
      .get();
    if (!createdLine) {
      throw new Error("ledger_line_create_failed");
    }
    writeOutboxEventSync(tx, {
      eventType: "ledger.entry.created",
      payload: {
        entryId: createdEntry.id,
        type: "DEPOSIT",
        userId: account.userId,
        accountIds: [createdLine.accountId],
        occurredAt: occurredAtDate.toISOString(),
        totalAmount: depositAmount,
        currency: createdLine.currency ?? account.baseCurrency,
        direction: "INFLOW",
        lines: [
          {
            id: createdLine.id,
            accountId: createdLine.accountId,
            amount: Number(createdLine.amount ?? 0),
            currency: createdLine.currency,
          },
        ],
      },
    });
    if (
      account.accountType === "INVESTMENT" &&
      typeof tx.select === "function"
    ) {
      const latestSnapshot = tx
        .select()
        .from(valuationSnapshots)
        .where(eq(valuationSnapshots.accountId, input.accountId))
        .orderBy(desc(valuationSnapshots.asOf))
        .limit(1)
        .get();
      const lineSum = tx
        .select({
          total: sql`sum(${txnLines.amount})`,
        })
        .from(txnLines)
        .where(eq(txnLines.accountId, input.accountId))
        .get();
      const summedAmount =
        lineSum?.total != null ? Number(lineSum.total) : 0;
      const principalAfter =
        Number(account.initialBalance ?? 0) + summedAmount;
      const previousValue =
        latestSnapshot?.totalValue != null
          ? Number(latestSnapshot.totalValue)
          : null;
      const previousValueNormalized =
        previousValue ?? principalAfter - depositAmount;
      const newValue = previousValueNormalized + depositAmount;
      const snapshotCurrency =
        latestSnapshot?.currency ?? account.baseCurrency;
      const snapshotFxSnapshotId = latestSnapshot?.fxSnapshotId ?? null;
      const snapshotFxAppliedRate =
        latestSnapshot?.fxAppliedRate != null
          ? Number(latestSnapshot.fxAppliedRate)
          : 1;
      const snapshotNote = latestSnapshot?.note ?? null;
      tx
        .insert(valuationSnapshots)
        .values({
          accountId: input.accountId,
          asOf: occurredAtDate,
          totalValue: String(newValue),
          currency: snapshotCurrency,
          fxSnapshotId: snapshotFxSnapshotId,
          fxAppliedRate: String(snapshotFxAppliedRate),
          note: input.note ?? snapshotNote,
        })
        .onConflictDoUpdate({
          target: [valuationSnapshots.accountId, valuationSnapshots.asOf],
          set: {
            totalValue: String(newValue),
            currency: snapshotCurrency,
            fxSnapshotId: snapshotFxSnapshotId,
            fxAppliedRate: String(snapshotFxAppliedRate),
            note: snapshotNote,
          },
        })
        .run();
    }
    return { ...createdEntry, lines: [createdLine] };
  };
  const entry = options.tx
    ? performDeposit(options.tx)
    : db.transaction((tx) => performDeposit(tx));
  await logAudit("ENTRY_DEPOSIT_SERVICE", {
    userId: account.userId,
    meta: { entryId: entry.id },
  });
  return entry;
}

export async function postTransfer(input: {
  from: { accountId: string; amount: number };
  to: { accountId: string; amount?: number };
  occurredAt: string;
  note?: string;
  asOf?: string;
  attachmentUrl?: string;
}) {
  const [fromAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, input.from.accountId))
    .limit(1);
  const [toAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, input.to.accountId))
    .limit(1);
  if (!fromAccount || !toAccount) throw new Error("Account not found");
  if (fromAccount.userId !== toAccount.userId) {
    throw new Error("accounts belong to different users");
  }
  if ((fromAccount.status ?? "ACTIVE") === "ARCHIVED") {
    throw new Error("from account is archived");
  }
  if ((toAccount.status ?? "ACTIVE") === "ARCHIVED") {
    throw new Error("to account is archived");
  }
  const absoluteFromAmount = Math.abs(input.from.amount);
  if (!Number.isFinite(absoluteFromAmount) || absoluteFromAmount <= 0) {
    throw new Error("invalid transfer amount");
  }
  const occurredAtDate = new Date(input.occurredAt);
  if (Number.isNaN(occurredAtDate.getTime())) {
    throw new Error("invalid occurredAt");
  }
  const fxAsOf = input.asOf ? new Date(input.asOf) : occurredAtDate;
  if (Number.isNaN(fxAsOf.getTime())) {
    throw new Error("invalid fx effective time");
  }
  let conversion:
    | Awaited<ReturnType<typeof convert>>
    | {
        amount: number;
        effectiveRate: number;
        viaCurrency: string;
        rateAtoUsd: number;
        rateUsdToB: number;
        fxEffectiveAt: Date;
        snapshots: unknown[];
      };
  try {
    conversion = await convert(
      absoluteFromAmount,
      fromAccount.baseCurrency,
      toAccount.baseCurrency,
      fxAsOf,
    );
  } catch (_error) {
    conversion = {
      amount: input.to.amount ?? absoluteFromAmount,
      effectiveRate: 1,
      viaCurrency: "USD",
      rateAtoUsd: 1,
      rateUsdToB: 1,
      fxEffectiveAt: fxAsOf,
      snapshots: [],
    };
  }
  const snapshots: FxSnapshotInfo[] = Array.isArray(conversion.snapshots)
    ? conversion.snapshots
    : [];
  let toAmount = conversion.amount;
  if (input.to.amount != null) {
    const parsed = Math.abs(Number(input.to.amount));
    if (Number.isFinite(parsed) && parsed > 0) {
      toAmount = parsed;
    }
  }
  if (!Number.isFinite(toAmount) || toAmount <= 0) {
    throw new Error("invalid converted amount");
  }
  const normalizedFromCurrency = fromAccount.baseCurrency.toUpperCase();
  const normalizedToCurrency = toAccount.baseCurrency.toUpperCase();
  const fromSnapshot =
    snapshots.find(
      (snapshot) => snapshot.quoteCurrency.toUpperCase() === normalizedFromCurrency,
    ) ?? null;
  const toSnapshot =
    snapshots.find(
      (snapshot) => snapshot.quoteCurrency.toUpperCase() === normalizedToCurrency,
    ) ?? null;
  const attachment =
    typeof input.attachmentUrl === "string" &&
    input.attachmentUrl.trim().length > 0
      ? input.attachmentUrl.trim()
      : undefined;
  const metaPayload = {
    fromAmount: absoluteFromAmount,
    fromCurrency: fromAccount.baseCurrency,
    toAmount,
    toCurrency: toAccount.baseCurrency,
    effectiveRate: conversion.effectiveRate,
    viaCurrency: conversion.viaCurrency,
    rateAtoUsd: conversion.rateAtoUsd,
    rateUsdToB: conversion.rateUsdToB,
    fxEffectiveAt:
      conversion.fxEffectiveAt?.toISOString() ?? fxAsOf.toISOString(),
    rateSnapshots: snapshots.map((snapshot) => {
      const captured =
        snapshot.capturedAt instanceof Date
          ? snapshot.capturedAt
          : conversion.fxEffectiveAt instanceof Date
            ? conversion.fxEffectiveAt
            : fxAsOf;
      return {
        base: snapshot.baseCurrency ?? fromAccount.baseCurrency,
        quote: snapshot.quoteCurrency ?? toAccount.baseCurrency,
        rate: Number(snapshot.rate ?? 1),
        capturedAt: captured.toISOString(),
        effectiveFrom:
          snapshot.effectiveFrom instanceof Date
            ? snapshot.effectiveFrom.toISOString()
            : null,
        effectiveTo:
          snapshot.effectiveTo instanceof Date
            ? snapshot.effectiveTo.toISOString()
            : null,
        id: snapshot.id ?? null,
        sourceRateId: snapshot.sourceRateId ?? null,
      };
    }),
    asOf: input.asOf ?? null,
  };
  const entry = db.transaction((tx) => {
    const createdEntry = tx
      .insert(txnEntries)
      .values({
        userId: fromAccount.userId,
        type: "TRANSFER",
        occurredAt: occurredAtDate,
        fxSnapshotId: fromSnapshot?.id ?? toSnapshot?.id ?? null,
        fxAppliedRate: String(conversion.effectiveRate),
        note: input.note,
        meta: JSON.stringify(metaPayload),
      })
      .returning()
      .get();
    if (!createdEntry) {
      throw new Error("ledger_entry_create_failed");
    }
    const fromLine = tx
      .insert(txnLines)
      .values({
        entryId: createdEntry.id,
        accountId: input.from.accountId,
        type: "TRANSFER",
        amount: String(-absoluteFromAmount),
        currency: fromAccount.baseCurrency,
        counterpartyAccountId: input.to.accountId,
        counterpartyName: toAccount.name,
        exchangeRateAB: String(conversion.effectiveRate),
        viaCurrency: conversion.viaCurrency,
        rateAtoUSD: String(conversion.rateAtoUsd),
        rateUSDtoB: String(conversion.rateUsdToB),
        fxEffectiveAt: conversion.fxEffectiveAt ?? fxAsOf,
        fxSnapshotId: fromSnapshot?.id ?? null,
        fxAppliedRate: String(fromSnapshot?.rate ?? 1),
        principalDelta: String(-absoluteFromAmount),
        valuationDelta: String(-absoluteFromAmount),
        note: input.note,
        attachmentUrl: attachment,
      })
      .returning()
      .get();
    const toLine = tx
      .insert(txnLines)
      .values({
        entryId: createdEntry.id,
        accountId: input.to.accountId,
        type: "TRANSFER",
        amount: String(Math.abs(toAmount)),
        currency: toAccount.baseCurrency,
        counterpartyAccountId: input.from.accountId,
        counterpartyName: fromAccount.name,
        exchangeRateAB: String(conversion.effectiveRate),
        viaCurrency: conversion.viaCurrency,
        rateAtoUSD: String(conversion.rateAtoUsd),
        rateUSDtoB: String(conversion.rateUsdToB),
        fxEffectiveAt: conversion.fxEffectiveAt ?? fxAsOf,
        fxSnapshotId: toSnapshot?.id ?? null,
        fxAppliedRate: String(toSnapshot?.rate ?? 1),
        principalDelta: String(Math.abs(toAmount)),
        valuationDelta: String(Math.abs(toAmount)),
        note: input.note,
        attachmentUrl: attachment,
      })
      .returning()
      .get();
    if (!fromLine || !toLine) {
      throw new Error("ledger_line_create_failed");
    }
    writeOutboxEventSync(tx, {
      eventType: "ledger.entry.created",
      payload: {
        entryId: createdEntry.id,
        type: "TRANSFER",
        userId: fromAccount.userId,
        occurredAt: occurredAtDate.toISOString(),
        accountIds: [fromLine.accountId, toLine.accountId],
        currency: fromAccount.baseCurrency,
        counterCurrency: toAccount.baseCurrency,
        conversion: { ...metaPayload, effectiveRate: conversion.effectiveRate },
        lines: [fromLine, toLine].map((line) => ({
          id: line.id,
          accountId: line.accountId,
          amount: Number(line.amount ?? 0),
          currency: line.currency,
          direction: Number(line.amount ?? 0) >= 0 ? "INFLOW" : "OUTFLOW",
        })),
      },
    });
    return { ...createdEntry, lines: [fromLine, toLine] };
  });
  await logAudit("ENTRY_TRANSFER_SERVICE", {
    userId: fromAccount.userId,
    meta: { entryId: entry.id },
  });
  return entry;
}
