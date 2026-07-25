import { NextResponse } from "next/server";
import db from "@/server/db";
import { equityGrants, equityVests } from "@/server/db/schema";
import { scheduleIncomeRecalcTask } from "@/server/services/income-tax/income";
import { getUserFromRequest } from "@/server/utils/auth";
import { eq } from "drizzle-orm";

/**
 * POST /api/v1/income-tax/equity/grants/:id/generate
 * - 根据授予生成归属日程（vests）。
 * - 入参: none
 */

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const user = await getUserFromRequest(req);
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [grant] = await db
    .select()
    .from(equityGrants)
    .where(eq(equityGrants.id, id))
    .limit(1);
  if (!grant || grant.userId !== user.id)
    return NextResponse.json({ error: "Grant not found" }, { status: 404 });
  const start = new Date(grant.startVestDate);
  let monthsStep = 12;
  if (grant.vestInterval === "QUARTERLY") monthsStep = 3;
  if (grant.vestInterval === "MONTHLY") monthsStep = 1;
  const per = Number(grant.totalUnits) / grant.vestPeriods;
  const data = Array.from({ length: grant.vestPeriods }).map((_, i) => {
    const d = new Date(start);
    d.setMonth(d.getMonth() + i * monthsStep);
    return {
      grantId: grant.id,
      vestDate: d,
      units: per,
      currency: grant.currency,
    };
  });
  for (const v of data) {
    await db
      .insert(equityVests)
      .values({
        grantId: v.grantId,
        vestDate: v.vestDate,
        units: String(v.units),
        currency: v.currency,
      })
      .onConflictDoUpdate({
        target: [equityVests.grantId, equityVests.vestDate],
        set: {
          units: String(v.units),
          currency: v.currency,
        },
      });
  }
  const affectedYears = new Set<number>();
  data.forEach((item) => {
    const year = item.vestDate.getUTCFullYear();
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
