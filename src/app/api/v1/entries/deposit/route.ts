import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import { ensureIdempotent, markIdempotencyUsed } from "@/server/utils/idempotency";
import { logAudit } from "@/server/services/audit";
import { getUserFromRequest } from "@/server/utils/auth";

/**
 * POST /api/v1/entries/deposit
 * - 存入资金（账户币种记账）。
 * - 入参: { accountId: string, amount: number, occurredAt: ISOString, note?: string }
 * - 返回: TxnEntry（含 lines）
 */
export async function POST(req: NextRequest) {
  const { accountId, amount, occurredAt, note } = await req.json();
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account || account.userId !== (user as any).id) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  const { key, existed } = await ensureIdempotent(req, (user as any).id, `${accountId}:${amount}:${occurredAt}:${note ?? ""}`);
  if (existed) return NextResponse.json({ error: "Idempotency key reused" }, { status: 409 });
  const entry = await prisma.txnEntry.create({
    data: {
      userId: (user as any).id,
      type: "DEPOSIT",
      occurredAt: new Date(occurredAt),
      note,
      lines: {
        create: {
          accountId,
          amount: amount,
          currency: account.baseCurrency,
          note,
        },
      },
    },
    include: { lines: true },
  });
  await logAudit("ENTRY_DEPOSIT", { userId: (user as any).id, meta: { entryId: entry.id } });
  await markIdempotencyUsed(key);
  return NextResponse.json(entry, { status: 201 });
}
