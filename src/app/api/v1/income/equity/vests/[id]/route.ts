import { NextResponse } from "next/server";
import prisma from "@/server/db";
import { scheduleIncomeRecalcTask } from "@/server/services/income-tax/income";
import { getUserFromRequest } from "@/server/utils/auth";

/**
 * PATCH /api/v1/income/equity/vests/:id
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
  const vest = await prisma.equityVest.findUnique({
    where: { id },
    include: { grant: true },
  });
  if (!vest || vest.grant.userId !== user.id)
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  const updated = await prisma.equityVest.update({
    where: { id },
    data: { fairValue, currency },
  });
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
