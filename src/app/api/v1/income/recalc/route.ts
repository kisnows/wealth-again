import { NextResponse } from "next/server";
import { logAudit } from "@/server/services/audit";
import { recalcIncome } from "@/server/services/income";
import {
  ensureIdempotent,
  markIdempotencyUsed,
} from "@/server/utils/idempotency";

/**
 * POST /api/v1/income/recalc
 * - 年度累计回算：按 1..M 累计计算个税，逐月回填 IncomeRecord。
 * - 入参: { taxYear: number, endMonth: number(1-12), cityId?: string }
 * - 返回: 501 TODO（占位），后续返回 { updated: number }
 */

export async function POST(req: Request) {
  const { taxYear, endMonth, cityId, userId, startMonth } = await req.json();
  if (!taxYear || !endMonth)
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const { key, existed } = await ensureIdempotent(
    req,
    undefined,
    `${taxYear}:${endMonth}:${cityId ?? ""}:${userId ?? ""}:${startMonth ?? ""}`,
  );
  if (existed)
    return NextResponse.json(
      { error: "Idempotency key reused" },
      { status: 409 },
    );
  const res = await recalcIncome({
    taxYear,
    endMonth,
    cityId,
    userId,
    startMonth,
  });
  await logAudit("INCOME_RECALC", {
    meta: {
      taxYear,
      endMonth,
      cityId,
      userId,
      startMonth,
      updated: res.updated,
    },
  });
  await markIdempotencyUsed(key);
  return NextResponse.json(res);
}
