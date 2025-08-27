import { NextResponse } from "next/server";
import prisma from "@/server/db";
import { ensureIdempotent, markIdempotencyUsed } from "@/server/utils/idempotency";
import { logAudit } from "@/server/services/audit";
import { getUserFromRequest } from "@/server/utils/auth";

/**
 * POST /api/v1/valuations
 * - 记录账户估值快照（SAVINGS 禁止）。
 * - 入参: { accountId: string, asOf: string(ISO), totalValue: number, currency?: string, fxRateId?: string }
 * - 返回: { todo: string }
 */

// POST /api/v1/valuations 记录账户估值快照（SAVINGS 禁止）
export async function POST(req: Request) {
  const { accountId, asOf, totalValue, currency, fxRateId, note } = await (req as any).json();
  if (!accountId || !asOf || typeof totalValue !== "number") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const user = await getUserFromRequest(req as any);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account || account.userId !== (user as any).id) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  if (account.accountType === "SAVINGS") {
    return NextResponse.json({ error: "SAVINGS account does not accept valuation" }, { status: 400 });
  }
  const { key, existed } = await ensureIdempotent(req as any, (user as any).id, `${accountId}:${asOf}:${totalValue}`);
  if (existed) return NextResponse.json({ error: "Idempotency key reused" }, { status: 409 });
  const created = await prisma.valuationSnapshot.create({
    data: {
      accountId,
      asOf: new Date(asOf),
      totalValue,
      currency: currency || account.baseCurrency,
      fxRateId: fxRateId || undefined,
      note,
    },
  });
  await logAudit("VALUATION_CREATE", { userId: (user as any).id, meta: { accountId } });
  await markIdempotencyUsed(key);
  return NextResponse.json(created, { status: 201 });
}
