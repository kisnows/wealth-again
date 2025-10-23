import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import { logAudit } from "@/server/services/audit";
import { scheduleIncomeRecalcTask } from "@/server/services/income";
import { getUserFromRequest } from "@/server/utils/auth";
import {
  ensureIdempotent,
  markIdempotencyUsed,
} from "@/server/utils/idempotency";

/**
 * GET /api/v1/income/bonus
 * - 列出一次性奖金计划。
 * POST /api/v1/income/bonus
 * - 新增一次性奖金。
 * - 入参: { userId: string, amount: number, currency?: string, taxMethod?: "MERGE"|"SEPARATE", effectiveDate: string(ISO) }
 */

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const items = await prisma.bonusPlan.findMany({
    where: { userId: user.id },
    orderBy: { effectiveDate: "asc" },
  });
  return NextResponse.json({ items });
}

type CreateBonusPayload = {
  amount: number;
  currency?: string;
  taxMethod?: "MERGE" | "SEPARATE";
  effectiveDate: string;
};

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const {
    amount,
    currency = "CNY",
    taxMethod = "MERGE",
    effectiveDate,
  } = (await req.json()) as CreateBonusPayload;
  if (typeof amount !== "number" || !effectiveDate) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const userId = user.id;
  const { key, existed } = await ensureIdempotent(
    req,
    userId,
    `${userId}:${amount}:${effectiveDate}`,
  );
  if (existed)
    return NextResponse.json(
      { error: "Idempotency key reused" },
      { status: 409 },
    );
  const normalizedCurrency = currency.toUpperCase();
  const created = await prisma.bonusPlan.create({
    data: {
      userId,
      amount,
      currency: normalizedCurrency,
      taxMethod,
      effectiveDate: new Date(effectiveDate),
    },
  });
  const payDate = new Date(effectiveDate);
  if (!Number.isNaN(payDate.getTime())) {
    await scheduleIncomeRecalcTask({
      userId,
      taxYear: payDate.getUTCFullYear(),
      startMonth: payDate.getUTCMonth() + 1,
      endMonth: 12,
      triggeredBy: user.id,
    });
  }
  await logAudit("INCOME_BONUS_CREATE", { userId, meta: { id: created.id } });
  await markIdempotencyUsed(key);
  return NextResponse.json(created, { status: 201 });
}
