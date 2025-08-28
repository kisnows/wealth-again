import { NextResponse } from "next/server";
import prisma from "@/server/db";
import { getUserFromRequest } from "@/server/utils/auth";

/**
 * POST /api/v1/income/equity/grants/:id/generate
 * - 根据授予生成归属日程（vests）。
 * - 入参: none
 */

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getUserFromRequest(req as any);
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const grant = await prisma.equityGrant.findUnique({
    where: { id },
  });
  if (!grant || grant.userId !== (user as any).id)
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
    await prisma.equityVest.upsert({
      where: { grantId_vestDate: { grantId: v.grantId, vestDate: v.vestDate } },
      update: { units: v.units, currency: v.currency },
      create: v,
    });
  }
  return NextResponse.json({ generated: data.length });
}
