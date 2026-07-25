import { NextResponse } from "next/server";
import db from "@/server/db";
import { taxConfig } from "@/server/db/schema";
import { logAudit } from "@/server/services/audit";
import {
  ensureIdempotent,
  markIdempotencyUsed,
} from "@/server/utils/idempotency";

export const runtime = "nodejs";

/**
 * PUT /api/v1/income-tax/rules/tax/config
 * - upsert 税制（国家 + 税年 + 标准扣除）。
 * - 入参: { country: string, taxYear: number, standardDeduction: number, specialAdditionalDeduction?: number }
 */

export async function PUT(req: Request) {
  const { country, taxYear, standardDeduction, specialAdditionalDeduction } =
    await req.json();
  if (!country || !taxYear || typeof standardDeduction !== "number") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { key, existed } = await ensureIdempotent(
    req,
    undefined,
    `taxcfg:${country}:${taxYear}`,
  );
  if (existed)
    return NextResponse.json(
      { error: "Idempotency key reused" },
      { status: 409 },
    );
  const special =
    typeof specialAdditionalDeduction === "number"
      ? String(specialAdditionalDeduction)
      : undefined;
  const [cfg] = await db
    .insert(taxConfig)
    .values({
      country,
      taxYear,
      standardDeduction: String(standardDeduction),
      specialAdditionalDeduction: special ?? "0",
    })
    .onConflictDoUpdate({
      target: [taxConfig.country, taxConfig.taxYear],
      set: {
        standardDeduction: String(standardDeduction),
        ...(special !== undefined
          ? { specialAdditionalDeduction: special }
          : {}),
      },
    })
    .returning();
  await logAudit("RULE_TAX_CONFIG_UPSERT", { meta: { country, taxYear } });
  await markIdempotencyUsed(key);
  return NextResponse.json(cfg);
}
