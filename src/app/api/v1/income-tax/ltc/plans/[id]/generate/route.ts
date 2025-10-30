import { NextResponse } from "next/server";
import prisma from "@/server/db";
import { scheduleIncomeRecalcTask } from "@/server/services/income-tax/income";
import { getUserFromRequest } from "@/server/utils/auth";

/**
 * POST /api/v1/income-tax/ltc/plans/:id/generate
 * - 根据计划生成发放日程（payouts）。
 * - 入参: none
 */

// 生成长期现金发放日程
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const user = await getUserFromRequest(req);
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const plan = await prisma.longTermCashPlan.findUnique({
    where: { id },
  });
  if (!plan || plan.userId !== user.id)
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  const start = new Date(plan.startDate);
  let monthsStep = 3;
  if (plan.recurrence === "MONTHLY") monthsStep = 1;
  if (plan.recurrence === "YEARLY") monthsStep = 12;
  const per = Number(plan.totalAmount) / plan.periods;
  const data = Array.from({ length: plan.periods }).map((_, i) => {
    const d = new Date(start);
    d.setMonth(d.getMonth() + i * monthsStep);
    return {
      planId: plan.id,
      payDate: d,
      amount: per,
      currency: plan.currency,
    };
  });
  for (const p of data) {
    await prisma.longTermCashPayout.upsert({
      where: { planId_payDate: { planId: p.planId, payDate: p.payDate } },
      update: { amount: p.amount, currency: p.currency },
      create: p,
    });
  }
  const affectedYears = new Set<number>();
  data.forEach((item) => {
    const year = item.payDate.getUTCFullYear();
    if (!Number.isNaN(year)) affectedYears.add(year);
  });
  for (const year of affectedYears) {
    await scheduleIncomeRecalcTask({
      userId: user.id,
      taxYear: year,
      startMonth: 1,
      endMonth: 12,
      triggeredBy: user.id,
    });
  }
  return NextResponse.json({ generated: data.length });
}
