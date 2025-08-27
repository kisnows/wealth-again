import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import { ensureIdempotent, markIdempotencyUsed } from "@/server/utils/idempotency";
import { logAudit } from "@/server/services/audit";
import { getUserFromRequest } from "@/server/utils/auth";

/**
 * GET /api/v1/income/ltc/plans
 * - 列出长期现金计划。
 * POST /api/v1/income/ltc/plans
 * - 创建长期现金计划。
 * - 入参: { userId: string, totalAmount: number, currency?: string, startDate: string(ISO), periods: number, recurrence: "MONTHLY"|"QUARTERLY"|"YEARLY" }
 */

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const items = await prisma.longTermCashPlan.findMany({ where: { userId: (user as any).id }, orderBy: { startDate: "asc" } });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const user = await getUserFromRequest(req as any);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { totalAmount, currency = "CNY", startDate, periods, recurrence } = await (req as any).json();
  if (typeof totalAmount !== "number" || !startDate || !periods || !recurrence) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const userId = (user as any).id;
  const { key, existed } = await ensureIdempotent(req as any, userId, `${userId}:${totalAmount}:${startDate}:${periods}:${recurrence}`);
  if (existed) return NextResponse.json({ error: "Idempotency key reused" }, { status: 409 });
  const created = await prisma.longTermCashPlan.create({
    data: { userId, totalAmount, currency, startDate: new Date(startDate), periods, recurrence },
  });
  await logAudit("INCOME_LTC_PLAN_CREATE", { userId, meta: { id: created.id } });
  await markIdempotencyUsed(key);
  return NextResponse.json(created, { status: 201 });
}
