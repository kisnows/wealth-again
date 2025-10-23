import type { Prisma } from "@prisma/client";
import prisma from "@/server/db";
import {
  computeAccountSummaryById,
  type AccountSummaryItem,
} from "@/server/services/accounts-summary";
import { convert } from "@/server/services/fx";
import { logAudit } from "@/server/services/audit";

export async function getAccountSummary(id: string) {
  const summary = await computeAccountSummaryById({ accountId: id });
  return summary as AccountSummaryItem | null;
}

export async function postDeposit(input: {
  accountId: string;
  amount: number;
  occurredAt: string;
  note?: string;
  attachmentUrl?: string;
}) {
  const account = await prisma.account.findUnique({
    where: { id: input.accountId },
  });
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
  const performDeposit = async (tx: typeof prisma) => {
    const lineInput = {
      accountId: input.accountId,
      type: "DEPOSIT",
      amount: depositAmount,
      currency: account.baseCurrency,
      fxSnapshotId: null,
      fxAppliedRate: 1,
      principalDelta: depositAmount,
      valuationDelta: depositAmount,
      note: input.note,
      attachmentUrl: attachment,
    } satisfies Record<string, unknown>;
    const createdEntry = await tx.txnEntry.create({
      data: {
        userId: account.userId,
        type: "DEPOSIT",
        occurredAt: occurredAtDate,
        fxSnapshotId: null,
        fxAppliedRate: 1,
        note: input.note,
        lines: {
          create: lineInput as unknown as Prisma.TxnLineCreateWithoutEntryInput,
        },
      },
      include: { lines: true },
    });
    if (
      account.accountType === "INVESTMENT" &&
      typeof tx.valuationSnapshot?.findFirst === "function" &&
      typeof tx.txnLine?.aggregate === "function"
    ) {
      const [latestSnapshot, lineSum] = await Promise.all([
        tx.valuationSnapshot.findFirst({
          where: { accountId: input.accountId },
          orderBy: { asOf: "desc" },
        }),
        tx.txnLine.aggregate({
          where: { accountId: input.accountId },
          _sum: { amount: true },
        }),
      ]);
      const summedAmount =
        lineSum._sum.amount != null ? Number(lineSum._sum.amount) : 0;
      const principalAfter =
        Number(account.initialBalance ?? 0) + summedAmount;
      const previousValue =
        latestSnapshot?.totalValue?.toNumber() ??
        principalAfter - depositAmount;
      const newValue = previousValue + depositAmount;
      const snapshotCurrency =
        latestSnapshot?.currency ?? account.baseCurrency;
      const snapshotFxSnapshotId = latestSnapshot?.fxSnapshotId ?? null;
      const snapshotFxAppliedRate =
        latestSnapshot?.fxAppliedRate != null
          ? Number(latestSnapshot.fxAppliedRate)
          : 1;
      const snapshotNote = latestSnapshot?.note ?? null;
      if (typeof tx.valuationSnapshot?.upsert === "function") {
        await tx.valuationSnapshot.upsert({
          where: {
            accountId_asOf: {
              accountId: input.accountId,
              asOf: occurredAtDate,
            },
          },
          update: {
            totalValue: newValue,
            currency: snapshotCurrency,
            fxSnapshotId: snapshotFxSnapshotId,
            fxAppliedRate: snapshotFxAppliedRate,
            note: snapshotNote,
          },
          create: {
            accountId: input.accountId,
            asOf: occurredAtDate,
            totalValue: newValue,
            currency: snapshotCurrency,
            fxSnapshotId: snapshotFxSnapshotId,
            fxAppliedRate: snapshotFxAppliedRate,
            note: input.note ?? snapshotNote,
          },
        });
      }
    }
    return createdEntry;
  };
  const entry =
    typeof (prisma as any).$transaction === "function"
      ? await prisma.$transaction((tx) =>
          performDeposit(tx as unknown as typeof prisma),
        )
      : await performDeposit(prisma);
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
  const fromAccount = await prisma.account.findUnique({
    where: { id: input.from.accountId },
  });
  const toAccount = await prisma.account.findUnique({
    where: { id: input.to.accountId },
  });
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
  const snapshots = Array.isArray(conversion.snapshots)
    ? conversion.snapshots
    : [];
  let toAmount = conversion.amount;
  const sameCurrency =
    fromAccount.baseCurrency.toUpperCase() ===
    toAccount.baseCurrency.toUpperCase();
  if (sameCurrency && input.to.amount != null) {
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
      (snapshot: any) =>
        snapshot?.quoteCurrency?.toUpperCase?.() === normalizedFromCurrency,
    ) ?? null;
  const toSnapshot =
    snapshots.find(
      (snapshot: any) =>
        snapshot?.quoteCurrency?.toUpperCase?.() === normalizedToCurrency,
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
    rateSnapshots: snapshots.map((snapshot: any) => {
      const captured =
        snapshot?.capturedAt instanceof Date
          ? snapshot.capturedAt
          : conversion.fxEffectiveAt instanceof Date
            ? conversion.fxEffectiveAt
            : fxAsOf;
      return {
        base: snapshot?.baseCurrency ?? fromAccount.baseCurrency,
        quote: snapshot?.quoteCurrency ?? toAccount.baseCurrency,
        rate: Number(snapshot?.rate ?? 1),
        capturedAt: captured.toISOString(),
        effectiveFrom:
          snapshot?.effectiveFrom instanceof Date
            ? snapshot.effectiveFrom.toISOString()
            : null,
        effectiveTo:
          snapshot?.effectiveTo instanceof Date
            ? snapshot.effectiveTo.toISOString()
            : null,
        id: snapshot?.id ?? null,
        sourceRateId: snapshot?.sourceRateId ?? null,
      };
    }),
    asOf: input.asOf ?? null,
  };
  const entry = await prisma.txnEntry.create({
    data: {
      userId: fromAccount.userId,
      type: "TRANSFER",
      occurredAt: occurredAtDate,
      fxSnapshotId: fromSnapshot?.id ?? toSnapshot?.id ?? null,
      fxAppliedRate: conversion.effectiveRate,
      note: input.note,
      meta: JSON.stringify(metaPayload),
      lines: {
        create: [
          {
            accountId: input.from.accountId,
            type: "TRANSFER",
            amount: -absoluteFromAmount,
            currency: fromAccount.baseCurrency,
            counterpartyAccountId: input.to.accountId,
            counterpartyName: toAccount.name,
            exchangeRateAB: conversion.effectiveRate,
            viaCurrency: conversion.viaCurrency,
            rateAtoUSD: conversion.rateAtoUsd,
            rateUSDtoB: conversion.rateUsdToB,
            fxEffectiveAt: conversion.fxEffectiveAt ?? fxAsOf,
            fxSnapshotId: fromSnapshot?.id ?? null,
            fxAppliedRate: fromSnapshot?.rate ?? 1,
            principalDelta: -absoluteFromAmount,
            valuationDelta: -absoluteFromAmount,
            note: input.note,
            attachmentUrl: attachment,
          },
          {
            accountId: input.to.accountId,
            type: "TRANSFER",
            amount: Math.abs(toAmount),
            currency: toAccount.baseCurrency,
            counterpartyAccountId: input.from.accountId,
            counterpartyName: fromAccount.name,
            exchangeRateAB: conversion.effectiveRate,
            viaCurrency: conversion.viaCurrency,
            rateAtoUSD: conversion.rateAtoUsd,
            rateUSDtoB: conversion.rateUsdToB,
            fxEffectiveAt: conversion.fxEffectiveAt ?? fxAsOf,
            fxSnapshotId: toSnapshot?.id ?? null,
            fxAppliedRate: toSnapshot?.rate ?? 1,
            principalDelta: Math.abs(toAmount),
            valuationDelta: Math.abs(toAmount),
            note: input.note,
            attachmentUrl: attachment,
          },
        ],
      },
    },
    include: { lines: true },
  });
  await logAudit("ENTRY_TRANSFER_SERVICE", {
    userId: fromAccount.userId,
    meta: { entryId: entry.id },
  });
  return entry;
}
