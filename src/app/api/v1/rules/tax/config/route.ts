import { NextResponse } from "next/server";
import prisma from "@/server/db";
import { ensureIdempotent, markIdempotencyUsed } from "@/server/utils/idempotency";
import { logAudit } from "@/server/services/audit";

/**
 * PUT /api/v1/rules/tax/config
 * - upsert 税制（国家 + 税年 + 标准扣除）。
 * - 入参: { country: string, taxYear: number, standardDeduction: number }
 */

export async function PUT(req: Request) {
  const { country, taxYear, standardDeduction } = await req.json();
  if (!country || !taxYear || typeof standardDeduction !== "number") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { key, existed } = await ensureIdempotent(req, undefined, `taxcfg:${country}:${taxYear}`);
  if (existed) return NextResponse.json({ error: "Idempotency key reused" }, { status: 409 });
  const cfg = await prisma.taxConfig.upsert({ where: { country_taxYear: { country, taxYear } }, update: { standardDeduction }, create: { country, taxYear, standardDeduction } });
  await logAudit("RULE_TAX_CONFIG_UPSERT", { meta: { country, taxYear } });
  await markIdempotencyUsed(key);
  return NextResponse.json(cfg);
}
