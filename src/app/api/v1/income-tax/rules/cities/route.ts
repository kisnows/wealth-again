import { NextResponse } from "next/server";
import db from "@/server/db";
import { cities } from "@/server/db/schema";
import { logAudit } from "@/server/services/audit";
import {
  ensureIdempotent,
  markIdempotencyUsed,
} from "@/server/utils/idempotency";

/**
 * PUT /api/v1/income-tax/rules/cities
 * - 批量 upsert 城市。
 * - 入参: Array<{ name: string, country?: string }>
 */

export async function PUT(req: Request) {
  const items = await req.json();
  if (!Array.isArray(items))
    return NextResponse.json({ error: "array body required" }, { status: 400 });
  const { key, existed } = await ensureIdempotent(
    req,
    undefined,
    `cities:${items.length}`,
  );
  if (existed)
    return NextResponse.json(
      { error: "Idempotency key reused" },
      { status: 409 },
    );
  for (const it of items) {
    await db
      .insert(cities)
      .values({ name: it.name, country: it.country || "CN" })
      .onConflictDoUpdate({
        target: cities.name,
        set: { country: it.country || "CN" },
      });
  }
  await logAudit("RULE_CITIES_UPSERT", { meta: { count: items.length } });
  await markIdempotencyUsed(key);
  return NextResponse.json({ upserted: items.length });
}
