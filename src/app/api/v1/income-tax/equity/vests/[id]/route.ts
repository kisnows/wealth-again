import { NextResponse } from "next/server";
import db from "@/server/db";
import { equityGrants, equityVests } from "@/server/db/schema";
import { scheduleIncomeRecalcTask } from "@/server/services/income-tax/income";
import { getUserFromRequest } from "@/server/utils/auth";
import { eq } from "drizzle-orm";

/**
 * PATCH /api/v1/income-tax/equity/vests/:id
 * - 在归属日回填 fairValue、currency（用于计税）。
 * - 入参: { fairValue: number, currency: string }
 */

// 回填归属日 fairValue/currency
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const user = await getUserFromRequest(req);
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { fairValue, currency } = (await req.json()) as {
    fairValue: number;
    currency: string;
  };
  if (typeof fairValue !== "number" || !currency) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const [vest] = await db
    .select({
      id: equityVests.id,
      vestDate: equityVests.vestDate,
      grantUserId: equityGrants.userId,
    })
    .from(equityVests)
    .innerJoin(equityGrants, eq(equityGrants.id, equityVests.grantId))
    .where(eq(equityVests.id, id))
    .limit(1);
  if (!vest || vest.grantUserId !== user.id)
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  const [updated] = await db
    .update(equityVests)
    .set({ fairValue: String(fairValue), currency: currency.toUpperCase() })
    .where(eq(equityVests.id, id))
    .returning();
  const vestDate = new Date(vest.vestDate);
  if (!Number.isNaN(vestDate.getTime())) {
    await scheduleIncomeRecalcTask({
      userId: user.id,
      taxYear: vestDate.getUTCFullYear(),
      startMonth: vestDate.getUTCMonth() + 1,
      endMonth: vestDate.getUTCMonth() + 1,
      triggeredBy: user.id,
    });
  }
  return NextResponse.json(updated);
}
