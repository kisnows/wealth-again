import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import { logAudit } from "@/server/services/audit";
import { scheduleIncomeRecalcTask } from "@/server/services/income-tax/income";
import { getUserFromRequest } from "@/server/utils/auth";
import {
  ensureIdempotent,
  markIdempotencyUsed,
} from "@/server/utils/idempotency";

/**
 * GET /api/v1/income/salary-changes
 * - 列出工资变更记录。
 * POST /api/v1/income/salary-changes
 * - 新增工资变更。
 * - 入参: { userId: string, grossMonthly: number, currency?: string, effectiveFrom: string(ISO) }
 */

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = user.id;
  const items = await prisma.incomeChange.findMany({
    where: { userId },
    orderBy: { effectiveFrom: "asc" },
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const {
    grossMonthly,
    currency = "CNY",
    effectiveFrom,
  } = (await req.json()) as {
    grossMonthly: number;
    currency?: string;
    effectiveFrom: string;
  };
  if (typeof grossMonthly !== "number" || !effectiveFrom) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const userId = user.id;
  const { key, existed } = await ensureIdempotent(
    req,
    userId,
    `${userId}:${grossMonthly}:${effectiveFrom}`,
  );
  if (existed)
    return NextResponse.json(
      { error: "Idempotency key reused" },
      { status: 409 },
    );
  const normalizedCurrency = currency.toUpperCase();
  const created = await prisma.incomeChange.create({
    data: {
      userId,
      grossMonthly,
      currency: normalizedCurrency,
      effectiveFrom: new Date(effectiveFrom),
    },
  });
  const effectiveDate = new Date(effectiveFrom);
  if (!Number.isNaN(effectiveDate.getTime())) {
    await scheduleIncomeRecalcTask({
      userId,
      taxYear: effectiveDate.getUTCFullYear(),
      startMonth: effectiveDate.getUTCMonth() + 1,
      endMonth: 12,
      triggeredBy: user.id,
    });
  }
  await logAudit("INCOME_SALARY_CHANGE_CREATE", {
    userId,
    meta: { id: created.id },
  });
  await markIdempotencyUsed(key);
  return NextResponse.json(created, { status: 201 });
}
