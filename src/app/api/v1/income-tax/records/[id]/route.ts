import { NextResponse } from "next/server";
import prisma from "@/server/db";
import { getUserFromRequest } from "@/server/utils/auth";

/**
 * PATCH /api/v1/income-tax/records/:id
 * - 覆盖指定月份的基础/专项扣除或人工值。
 * - 入参: Partial<{ socialInsuranceBase, housingFundBase, specialDeductions, otherDeductions, charityDonations, manualGross, manualTaxable, manualIncomeTax, manualNet, manualNote }>
 */

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const user = await getUserFromRequest(req);
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  type IncomeRecordPatchPayload = Partial<{
    socialInsuranceBase: number | null;
    housingFundBase: number | null;
    specialDeductions: number | null;
    otherDeductions: number | null;
    charityDonations: number | null;
    manualGross: number | null;
    manualTaxable: number | null;
    manualIncomeTax: number | null;
    manualNet: number | null;
    manualNote: string | null;
  }>;
  const body = (await req.json()) as IncomeRecordPatchPayload;
  const rec = await prisma.incomeRecord.findUnique({
    where: { id },
  });
  if (!rec || rec.userId !== user.id)
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  const data: Record<string, unknown> = {};
  const numericKeys: Array<keyof IncomeRecordPatchPayload> = [
    "socialInsuranceBase",
    "housingFundBase",
    "specialDeductions",
    "otherDeductions",
    "charityDonations",
    "manualGross",
    "manualTaxable",
    "manualIncomeTax",
    "manualNet",
  ];
  for (const key of numericKeys) {
    if (key in body) {
      const value = body[key];
      if (value === null || typeof value === "number") {
        data[key] = value;
      }
    }
  }
  if ("manualNote" in body) {
    data.manualNote = body.manualNote ?? null;
  }

  const nextManual = {
    manualGross:
      body.manualGross !== undefined ? body.manualGross : rec.manualGross,
    manualTaxable:
      body.manualTaxable !== undefined ? body.manualTaxable : rec.manualTaxable,
    manualIncomeTax:
      body.manualIncomeTax !== undefined
        ? body.manualIncomeTax
        : rec.manualIncomeTax,
    manualNet:
      body.manualNet !== undefined ? body.manualNet : rec.manualNet,
  };
  const hasManualOverride = Object.values(nextManual).some(
    (value) => value !== null && value !== undefined,
  );
  data.source = hasManualOverride ? "manual" : "system";

  const updated = await prisma.incomeRecord.update({
    where: { id },
    data,
  });
  return NextResponse.json(updated);
}
