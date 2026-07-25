import { type NextRequest, NextResponse } from "next/server";
import db from "@/server/db";
import { longTermCashPlans } from "@/server/db/schema";
import { logAudit } from "@/server/services/audit";
import { scheduleIncomeRecalcTask } from "@/server/services/income-tax/income";
import { getUserFromRequest } from "@/server/utils/auth";
import {
  ensureIdempotent,
  markIdempotencyUsed,
} from "@/server/utils/idempotency";
import { asc, eq } from "drizzle-orm";

/**
 * GET /api/v1/income-tax/ltc/plans
 * - 列出长期现金计划。
 * POST /api/v1/income-tax/ltc/plans
 * - 创建长期现金计划。
 * - 入参: { userId: string, totalAmount: number, currency?: string, startDate: string(ISO), periods: number, recurrence: "MONTHLY"|"QUARTERLY"|"YEARLY" }
 */

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = user.id;
  const items = await db
    .select()
    .from(longTermCashPlans)
    .where(eq(longTermCashPlans.userId, userId))
    .orderBy(asc(longTermCashPlans.startDate));
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const {
    totalAmount,
    currency = "CNY",
    startDate,
    periods,
    recurrence,
  } = (await req.json()) as {
    totalAmount: number;
    currency?: string;
    startDate: string;
    periods: number;
    recurrence: "MONTHLY" | "QUARTERLY" | "YEARLY";
  };
  if (
    typeof totalAmount !== "number" ||
    !startDate ||
    !periods ||
    !recurrence
  ) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const userId = user.id;
  const { key, existed } = await ensureIdempotent(
    req,
    userId,
    `${userId}:${totalAmount}:${startDate}:${periods}:${recurrence}`,
  );
  if (existed)
    return NextResponse.json(
      { error: "Idempotency key reused" },
      { status: 409 },
    );
  const [created] = await db
    .insert(longTermCashPlans)
    .values({
      userId,
      totalAmount: String(totalAmount),
      currency: currency.toUpperCase(),
      startDate: new Date(startDate),
      periods,
      recurrence,
    })
    .returning();
  const planStart = new Date(startDate);
  if (!Number.isNaN(planStart.getTime())) {
    await scheduleIncomeRecalcTask({
      userId,
      taxYear: planStart.getUTCFullYear(),
      startMonth: planStart.getUTCMonth() + 1,
      endMonth: 12,
      triggeredBy: user.id,
    });
  }
  await logAudit("INCOME_LTC_PLAN_CREATE", {
    userId,
    meta: { id: created.id },
  });
  await markIdempotencyUsed(key);
  return NextResponse.json(created, { status: 201 });
}
