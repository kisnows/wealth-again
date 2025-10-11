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
  let toAmount = Math.abs(to.amount ?? from.amount);
  // 跨币种：若未指定入账金额，则尝试按 asOf 汇率折算
  if (
    fromAccount.baseCurrency !== toAccount.baseCurrency &&
    to.amount == null
  ) {
    if (!asOf)
      return NextResponse.json(
        { error: "asOf required to convert cross-currency transfer" },
        { status: 400 },
      );
    try {
      toAmount = await convert(
        Math.abs(from.amount),
        fromAccount.baseCurrency,
        toAccount.baseCurrency,
        new Date(asOf),
      );
    } catch (_e) {
      return NextResponse.json(
        { error: "fx conversion failed" },
        { status: 400 },
      );
    }
  }
  const { key, existed } = await ensureIdempotent(
    req,
    userId,
    `${from.accountId}:${to.accountId}:${from.amount}:${to.amount ?? ""}:${occurredAt}`,
  );
  if (existed)
    return NextResponse.json(
      { error: "Idempotency key reused" },
      { status: 409 },
    );
  const entry = await prisma.txnEntry.create({
    data: {
      userId: userId,
      type: "TRANSFER",
      occurredAt: new Date(occurredAt),
      note,
      lines: {
        create: [
          {
            accountId: from.accountId,
            amount: -Math.abs(from.amount),
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
