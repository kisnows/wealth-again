import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import { logAudit } from "@/server/services/audit";
import {
  ensureIdempotent,
  markIdempotencyUsed,
} from "@/server/utils/idempotency";

/**
 * GET /api/v1/rules/tax/brackets?country=CN&taxYear=2025
 * - 查询对应年度税表档。
 * PUT /api/v1/rules/tax/brackets
 * - 批量 upsert 税表档。
 * - 入参: Array<{ country: string, taxYear: number, position: number, threshold: number, taxRate: number, quickDeduction: number }>
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const country = searchParams.get("country");
  const taxYear = Number(searchParams.get("taxYear"));
  if (!country || !taxYear)
    return NextResponse.json(
      { error: "country & taxYear required" },
      { status: 400 },
    );
  const items = await prisma.taxBracket.findMany({
    where: { country, taxYear },
    orderBy: { position: "asc" },
  });
  return NextResponse.json({ items });
}

export async function PUT(req: Request) {
  const items = await req.json();
  if (!Array.isArray(items))
    return NextResponse.json({ error: "array body required" }, { status: 400 });
  const { key, existed } = await ensureIdempotent(
    req,
    undefined,
    `taxbr:${items.length}`,
  );
  if (existed)
    return NextResponse.json(
      { error: "Idempotency key reused" },
      { status: 409 },
    );
  for (const it of items) {
    await prisma.taxBracket.upsert({
      where: {
        country_taxYear_position: {
          country: it.country,
          taxYear: it.taxYear,
          position: it.position,
        },
      },
      update: {
        threshold: it.threshold,
        taxRate: it.taxRate,
        quickDeduction: it.quickDeduction,
      },
      create: {
        country: it.country,
        taxYear: it.taxYear,
        position: it.position,
        threshold: it.threshold,
        taxRate: it.taxRate,
        quickDeduction: it.quickDeduction,
      },
    });
  }
  await logAudit("RULE_TAX_BRACKETS_UPSERT", { meta: { count: items.length } });
  await markIdempotencyUsed(key);
  return NextResponse.json({ upserted: items.length });
}
