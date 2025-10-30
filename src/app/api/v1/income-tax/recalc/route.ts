import { NextRequest, NextResponse } from "next/server";
import { audit } from "@/server/services/audit";
import {
  scheduleIncomeRecalcTask,
} from "@/server/services/income-tax/income";
import {
  ensureIdempotent,
  markIdempotencyUsed,
} from "@/server/utils/idempotency";
import { getUserFromRequest } from "@/server/utils/auth";

/**
 * POST /api/v1/income-tax/recalc
 * - 年度累计回算：按 1..M 累计计算个税，逐月回填 IncomeRecord。
 * - 入参: { taxYear: number, endMonth: number(1-12), cityId?: string }
 * - 返回: 501 TODO（占位），后续返回 { updated: number }
 */

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { taxYear, endMonth, cityId, userId, startMonth } = body;
  if (!taxYear || !endMonth)
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const actor = await getUserFromRequest(req);
  const targetUserId: string | undefined = userId ?? actor?.id ?? undefined;
  const { key, existed } = await ensureIdempotent(
    req,
    undefined,
    `${taxYear}:${endMonth}:${cityId ?? ""}:${targetUserId ?? ""}:${startMonth ?? ""}`,
  );
  if (existed)
    return NextResponse.json(
      { error: "Idempotency key reused" },
      { status: 409 },
    );
  const taskId = await scheduleIncomeRecalcTask({
    userId: targetUserId,
    taxYear,
    endMonth,
    startMonth,
    cityId,
    triggeredBy: actor?.id,
    delayMs: 0,
  });
  await audit.logAndEmit("INCOME_RECALC_ENQUEUED", {
    userId: actor?.id ?? null,
    meta: {
      taxYear,
      endMonth,
      startMonth: startMonth ?? null,
      cityId,
      userId: targetUserId,
      taskId,
    },
    eventType: "audit.income.recalc_enqueued",
  });
  await markIdempotencyUsed(key);
  return NextResponse.json({ taskId, status: "PENDING" }, { status: 202 });
}
