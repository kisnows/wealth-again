import { type NextRequest, NextResponse } from "next/server";
import db from "@/server/db";
import { taxBracket } from "@/server/db/schema";
import { logAudit } from "@/server/services/audit";
import {
  ensureIdempotent,
  markIdempotencyUsed,
} from "@/server/utils/idempotency";
import { and, asc, eq } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * GET /api/v1/income-tax/rules/tax/brackets?country=CN&taxYear=2025
 * - 查询对应年度税表档。
 * PUT /api/v1/income-tax/rules/tax/brackets
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
  const items = await db
    .select()
    .from(taxBracket)
    .where(
      and(eq(taxBracket.country, country), eq(taxBracket.taxYear, taxYear)),
    )
    .orderBy(asc(taxBracket.position));
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
    await db
      .insert(taxBracket)
      .values({
        country: it.country,
        taxYear: it.taxYear,
        position: it.position,
        threshold: String(it.threshold),
        taxRate: String(it.taxRate),
        quickDeduction: String(it.quickDeduction),
      })
      .onConflictDoUpdate({
        target: [taxBracket.country, taxBracket.taxYear, taxBracket.position],
        set: {
          threshold: String(it.threshold),
          taxRate: String(it.taxRate),
          quickDeduction: String(it.quickDeduction),
        },
      });
  }
  await logAudit("RULE_TAX_BRACKETS_UPSERT", { meta: { count: items.length } });
  await markIdempotencyUsed(key);
  return NextResponse.json({ upserted: items.length });
}
