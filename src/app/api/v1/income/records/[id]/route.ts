import { NextResponse } from "next/server";
import prisma from "@/server/db";

/**
 * PATCH /api/v1/income/records/:id
 * - 覆盖指定月份的基础/专项扣除等字段。
 * - 入参: Partial<{ socialInsuranceBase, housingFundBase, specialDeductions, otherDeductions, charityDonations }>
 */

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
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
  const updated = await prisma.incomeRecord.update({ where: { id: params.id }, data: allowed });
  return NextResponse.json(updated);
}
