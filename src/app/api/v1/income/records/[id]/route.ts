import { NextResponse } from "next/server";
import prisma from "@/server/db";
import { getUserFromRequest } from "@/server/utils/auth";

/**
 * PATCH /api/v1/income/records/:id
 * - 覆盖指定月份的基础/专项扣除等字段。
 * - 入参: Partial<{ socialInsuranceBase, housingFundBase, specialDeductions, otherDeductions, charityDonations }>
 */

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getUserFromRequest(req as any);
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await (req as any).json();
  const allowed: any = {};
  for (const k of [
    "socialInsuranceBase",
    "housingFundBase",
    "specialDeductions",
    "otherDeductions",
    "charityDonations",
  ]) {
    if (k in body) allowed[k] = body[k];
  }
  const rec = await prisma.incomeRecord.findUnique({
    where: { id },
  });
  if (!rec || rec.userId !== (user as any).id)
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  const updated = await prisma.incomeRecord.update({
    where: { id },
    data: allowed,
  });
  return NextResponse.json(updated);
}
