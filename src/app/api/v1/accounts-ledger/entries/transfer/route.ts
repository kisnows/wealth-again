import type { Prisma } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import { logAudit } from "@/server/services/audit";
import { convert } from "@/server/services/fx/provider";
import { writeOutboxEvent } from "@/server/services/outbox";
import { getUserFromRequest } from "@/server/utils/auth";
import {
  ensureIdempotent,
  markIdempotencyUsed,
} from "@/server/utils/idempotency";

type TransferFromInput = {
  accountId: string;
  amount: number;
};

type TransferToInput = {
  accountId: string;
  amount?: number | null;
};

type TransferRequestBody = {
  from: TransferFromInput;
  to: TransferToInput;
  occurredAt: string;
  note?: string | null;
  asOf?: string | null;
  attachmentUrl?: string | null;
};

/**
 * POST /api/v1/accounts-ledger/entries/transfer
 * - 同币种账户间转账；不同币种转账不允许（请先通过汇兑/调账实现）。
 * - 入参: { from: { accountId: string, amount: number }, to: { accountId: string, amount?: number }, occurredAt: ISOString, note?: string }
 * - 返回: TxnEntry（含两条 lines）
 */
export async function POST(req: NextRequest) {
  const { from, to, occurredAt, note, asOf, attachmentUrl } =
    (await req.json()) as TransferRequestBody & { attachmentUrl?: string };
  const user = await getUserFromRequest(req);
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = user.id;
  const fromAccount = await prisma.account.findUnique({
    where: { id: from.accountId },
  });
  const toAccount = await prisma.account.findUnique({
    where: { id: to.accountId },
  });
  if (!fromAccount || !toAccount) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  if (fromAccount.userId !== userId || toAccount.userId !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (
    (fromAccount.status ?? "ACTIVE") === "ARCHIVED" ||
    (toAccount.status ?? "ACTIVE") === "ARCHIVED"
  ) {
    return NextResponse.json(
      { error: "account is archived" },
      { status: 409 },
    );
  }
  const absoluteFromAmount = Math.abs(from.amount);
  const occurredAtDate = new Date(occurredAt);
  const fxAsOfDate = asOf ? new Date(asOf) : occurredAtDate;
  if (Number.isNaN(fxAsOfDate.getTime())) {
    return NextResponse.json(
      { error: "invalid fx effective time" },
      { status: 400 },
    );
  }
  let conversionResult: Awaited<ReturnType<typeof convert>>;
  try {
    conversionResult = await convert(
      absoluteFromAmount,
      fromAccount.baseCurrency,
      toAccount.baseCurrency,
      fxAsOfDate,
    );
  } catch (_error) {
    return NextResponse.json(
      { error: "fx conversion failed" },
      { status: 400 },
    );
  }
  let toAmount = conversionResult.amount;
  const sameCurrency =
    fromAccount.baseCurrency.toUpperCase() ===
    toAccount.baseCurrency.toUpperCase();
  if (sameCurrency) {
    toAmount = absoluteFromAmount;
    if (to.amount != null && Number.isFinite(to.amount)) {
      toAmount = Math.abs(Number(to.amount));
    }
  }
  if (!Number.isFinite(toAmount) || toAmount <= 0) {
    return NextResponse.json(
      { error: "invalid transfer amount" },
      { status: 400 },
    );
  }
  const { key, existed } = await ensureIdempotent(
    req,
    userId,
    `${from.accountId}:${to.accountId}:${from.amount}:${toAmount}:${occurredAt}`,
  );
  if (existed)
    return NextResponse.json(
      { error: "Idempotency key reused" },
      { status: 409 },
    );
  const snapshots = Array.isArray(conversionResult.snapshots)
    ? conversionResult.snapshots
    : [];
  const metaPayload = {
    fromAmount: absoluteFromAmount,
    fromCurrency: fromAccount.baseCurrency,
    toAmount,
    toCurrency: toAccount.baseCurrency,
    effectiveRate: conversionResult.effectiveRate,
    viaCurrency: conversionResult.viaCurrency,
    rateAtoUsd: conversionResult.rateAtoUsd,
    rateUsdToB: conversionResult.rateUsdToB,
    fxEffectiveAt:
      conversionResult.fxEffectiveAt?.toISOString() ?? fxAsOfDate.toISOString(),
    rateSnapshots: snapshots.map((snapshot) => {
      const captured =
        snapshot?.capturedAt instanceof Date
          ? snapshot.capturedAt
          : conversionResult.fxEffectiveAt instanceof Date
            ? conversionResult.fxEffectiveAt
            : fxAsOfDate;
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
    asOf: asOf ?? null,
  };
  const normalizedFromCurrency = fromAccount.baseCurrency.toUpperCase();
  const normalizedToCurrency = toAccount.baseCurrency.toUpperCase();
  const fromSnapshot =
    snapshots.find(
      (snapshot) =>
        snapshot?.quoteCurrency?.toUpperCase?.() === normalizedFromCurrency,
    ) ?? null;
  const toSnapshot =
    snapshots.find(
      (snapshot) =>
        snapshot?.quoteCurrency?.toUpperCase?.() === normalizedToCurrency,
    ) ?? null;
  const fromLineInput = {
    accountId: from.accountId,
    type: "TRANSFER",
    amount: -absoluteFromAmount,
    currency: fromAccount.baseCurrency,
    counterpartyAccountId: to.accountId,
    counterpartyName: toAccount.name,
    exchangeRateAB: conversionResult.effectiveRate,
    viaCurrency: conversionResult.viaCurrency,
    rateAtoUSD: conversionResult.rateAtoUsd,
    rateUSDtoB: conversionResult.rateUsdToB,
    fxEffectiveAt: conversionResult.fxEffectiveAt ?? fxAsOfDate,
    fxSnapshotId: fromSnapshot?.id ?? null,
    fxAppliedRate: fromSnapshot?.rate ?? 1,
    principalDelta: -absoluteFromAmount,
    valuationDelta: -absoluteFromAmount,
    note,
    attachmentUrl:
      typeof attachmentUrl === "string" && attachmentUrl.trim().length > 0
        ? attachmentUrl.trim()
        : undefined,
  } satisfies Record<string, unknown>;
  const toLineInput = {
    accountId: to.accountId,
    type: "TRANSFER",
    amount: Math.abs(toAmount),
    currency: toAccount.baseCurrency,
    counterpartyAccountId: from.accountId,
    counterpartyName: fromAccount.name,
    exchangeRateAB: conversionResult.effectiveRate,
    viaCurrency: conversionResult.viaCurrency,
    rateAtoUSD: conversionResult.rateAtoUsd,
    rateUSDtoB: conversionResult.rateUsdToB,
    fxEffectiveAt: conversionResult.fxEffectiveAt ?? fxAsOfDate,
    fxSnapshotId: toSnapshot?.id ?? null,
    fxAppliedRate: toSnapshot?.rate ?? 1,
    principalDelta: Math.abs(toAmount),
    valuationDelta: Math.abs(toAmount),
    note,
    attachmentUrl:
      typeof attachmentUrl === "string" && attachmentUrl.trim().length > 0
        ? attachmentUrl.trim()
        : undefined,
  } satisfies Record<string, unknown>;
  const entry = await prisma.$transaction(async (tx) => {
    const created = await tx.txnEntry.create({
      data: {
        userId: userId,
        type: "TRANSFER",
        occurredAt: occurredAtDate,
        fxSnapshotId: fromSnapshot?.id ?? toSnapshot?.id ?? null,
        fxAppliedRate: conversionResult.effectiveRate,
        note,
        meta: JSON.stringify(metaPayload),
        lines: {
          create: [
            fromLineInput as unknown as Prisma.TxnLineCreateWithoutEntryInput,
            toLineInput as unknown as Prisma.TxnLineCreateWithoutEntryInput,
          ],
        },
      },
      include: { lines: true },
    });
    const lines = Array.isArray(created.lines) ? created.lines : [];
    await writeOutboxEvent(tx, {
      eventType: "ledger.entry.created",
      payload: {
        entryId: created.id,
        type: "TRANSFER",
        userId,
        occurredAt: occurredAtDate.toISOString(),
        accountIds: lines.map((line) => line.accountId),
        currency: fromAccount.baseCurrency,
        counterCurrency: toAccount.baseCurrency,
        conversion: {
          ...metaPayload,
          effectiveRate: conversionResult.effectiveRate,
        },
        lines: lines.map((line) => ({
          id: line.id,
          accountId: line.accountId,
          amount: Number(line.amount ?? 0),
          currency: line.currency,
          direction: Number(line.amount ?? 0) >= 0 ? "INFLOW" : "OUTFLOW",
        })),
      },
    });
    return created;
  });
  await logAudit("ENTRY_TRANSFER", {
    userId,
    meta: { entryId: entry.id },
  });
  await markIdempotencyUsed(key);
  return NextResponse.json(entry, { status: 201 });
}
