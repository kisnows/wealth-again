import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import { logAudit } from "@/server/services/audit";
import { convert } from "@/server/services/fx";
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
};

/**
 * POST /api/v1/entries/transfer
 * - 同币种账户间转账；不同币种转账不允许（请先通过汇兑/调账实现）。
 * - 入参: { from: { accountId: string, amount: number }, to: { accountId: string, amount?: number }, occurredAt: ISOString, note?: string }
 * - 返回: TxnEntry（含两条 lines）
 */
export async function POST(req: NextRequest) {
  const { from, to, occurredAt, note, asOf } =
    (await req.json()) as TransferRequestBody;
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
  const absoluteFromAmount = Math.abs(from.amount);
  const sameCurrency = fromAccount.baseCurrency === toAccount.baseCurrency;
  let conversionResult:
    | { amount: number; effectiveRate: number; snapshots: Array<{ base: string; quote: string; rate: number; asOf: Date; id?: string }> }
    | null = null;
  let toAmount: number;
  if (sameCurrency) {
    toAmount = Math.abs(to.amount ?? absoluteFromAmount);
  } else {
    try {
      conversionResult = await convert(
        absoluteFromAmount,
        fromAccount.baseCurrency,
        toAccount.baseCurrency,
        asOf ? new Date(asOf) : undefined,
      );
    } catch (_e) {
      return NextResponse.json(
        { error: "fx conversion failed" },
        { status: 400 },
      );
    }
    toAmount = conversionResult.amount;
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
  const metaPayload = {
    fromAmount: absoluteFromAmount,
    fromCurrency: fromAccount.baseCurrency,
    toAmount,
    toCurrency: toAccount.baseCurrency,
    effectiveRate: conversionResult
      ? conversionResult.effectiveRate
      : 1,
    rateSnapshots: conversionResult
      ? conversionResult.snapshots.map((snapshot) => ({
          base: snapshot.base,
          quote: snapshot.quote,
          rate: snapshot.rate,
          asOf: snapshot.asOf.toISOString(),
          id: snapshot.id ?? null,
        }))
      : [],
    asOf: asOf ?? null,
  };
  const entry = await prisma.txnEntry.create({
    data: {
      userId: userId,
      type: "TRANSFER",
      occurredAt: new Date(occurredAt),
      note,
      meta: JSON.stringify(metaPayload),
      lines: {
        create: [
          {
            accountId: from.accountId,
            amount: -absoluteFromAmount,
            currency: fromAccount.baseCurrency,
            note,
          },
          {
            accountId: to.accountId,
            amount: toAmount,
            currency: toAccount.baseCurrency,
            note,
          },
        ],
      },
    },
    include: { lines: true },
  });
  await logAudit("ENTRY_TRANSFER", {
    userId,
    meta: { entryId: entry.id },
  });
  await markIdempotencyUsed(key);
  return NextResponse.json(entry, { status: 201 });
}
