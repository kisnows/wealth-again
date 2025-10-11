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
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const user = await getUserFromRequest(req);
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  type IncomeRecordPatchPayload = Partial<
    Record<
      | "socialInsuranceBase"
      | "housingFundBase"
      | "specialDeductions"
      | "otherDeductions"
      | "charityDonations",
      number
    >
  >;
  const body = (await req.json()) as IncomeRecordPatchPayload;
  const allowedKeys: Array<keyof IncomeRecordPatchPayload> = [
    "socialInsuranceBase",
    "housingFundBase",
    "specialDeductions",
    "otherDeductions",
    "charityDonations",
  ];
  const allowed = allowedKeys.reduce<IncomeRecordPatchPayload>((acc, key) => {
    const value = body[key];
    if (typeof value === "number") acc[key] = value;
    return acc;
  }, {});
  const rec = await prisma.incomeRecord.findUnique({
    where: { id },
  });
  if (!rec || rec.userId !== user.id)
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  const updated = await prisma.incomeRecord.update({
    where: { id },
    data: allowed,
  });
  return NextResponse.json(updated);
}
