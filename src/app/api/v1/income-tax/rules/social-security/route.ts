import type { City, CityRuleSS } from "@/server/db/types";
import { type NextRequest, NextResponse } from "next/server";
import db from "@/server/db";
import { cities, cityRuleSS } from "@/server/db/schema";
import { logAudit } from "@/server/services/audit";
import {
  ensureIdempotent,
  markIdempotencyUsed,
} from "@/server/utils/idempotency";
import { and, desc, eq, gt, isNull, lte, or } from "drizzle-orm";

/**
 * GET /api/v1/income-tax/rules/social-security?city=Hangzhou&on=2025-01-01
 * - 查询指定城市在某日期生效的社保规则。
 * PUT /api/v1/income-tax/rules/social-security
 * - 批量 upsert 社保规则。
 * - 入参: Array<{ city: string|id, effectiveFrom: ISO, effectiveTo?: ISO, currency?: string, baseMin, baseMax, ratePension, rateMedical, rateUnemployment, fixedMedicalPersonal?: number }>
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cityName = searchParams.get("city");
  const on = searchParams.get("on");
  if (!cityName || !on)
    return NextResponse.json({ error: "city & on required" }, { status: 400 });
  const [city] = await db
    .select()
    .from(cities)
    .where(eq(cities.name, cityName))
    .limit(1);
  if (!city)
    return NextResponse.json({ error: "city not found" }, { status: 404 });
  const onDate = new Date(on);
  const [rule] = await db
    .select()
    .from(cityRuleSS)
    .where(
      and(
        eq(cityRuleSS.cityId, city.id),
        lte(cityRuleSS.effectiveFrom, onDate),
        or(isNull(cityRuleSS.effectiveTo), gt(cityRuleSS.effectiveTo, onDate)),
      ),
    )
    .orderBy(desc(cityRuleSS.effectiveFrom))
    .limit(1);
  if (!rule) return NextResponse.json({ error: "No rule" }, { status: 404 });
  return NextResponse.json(rule);
}

export async function PUT(req: Request) {
  const items = await req.json();
  if (!Array.isArray(items))
    return NextResponse.json({ error: "array body required" }, { status: 400 });
  const { key, existed } = await ensureIdempotent(
    req,
    undefined,
    `ss:${items.length}`,
  );
  if (existed)
    return NextResponse.json(
      { error: "Idempotency key reused" },
      { status: 409 },
    );
  for (const it of items) {
    if (typeof it.city !== "string" || it.city.length === 0) {
      return NextResponse.json(
        { error: "city must be string" },
        { status: 400 },
      );
    }

    const city = await resolveCity(it.city, it.country);
    if (!city)
      return NextResponse.json(
        { error: "city not found", city: it.city },
        { status: 404 },
      );

    // overlap check (JS 级别)
    const existing = await db
      .select()
      .from(cityRuleSS)
      .where(eq(cityRuleSS.cityId, city.id));
    let effectiveFrom: Date;
    let effectiveTo: Date | null;
    try {
      ({ effectiveFrom, effectiveTo } = resolveEffectiveRange(it));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "invalid effective range";
      return NextResponse.json(
        { error: message, city: city.id },
        { status: 400 },
      );
    }
    const currency = resolveCurrency(it.currency);
    const ns = effectiveFrom;
    const ne = effectiveTo;
    const overlap = existing.some((r) => isOverlap(r, ns, ne));
    if (overlap)
      return NextResponse.json(
        { error: "interval overlaps existing rule", city: city.id },
        { status: 409 },
      );
    const baseMin = Number(it.baseMin ?? 0);
    const baseMax = Number(it.baseMax ?? 0);
    const ratePension = Number(it.ratePension ?? 0);
    const rateMedical = Number(it.rateMedical ?? 0);
    const rateUnemployment = Number(it.rateUnemployment ?? 0);
    await db
      .insert(cityRuleSS)
      .values({
        cityId: city.id,
        currency,
        effectiveFrom: ns,
        effectiveTo: ne,
        baseMin: String(baseMin),
        baseMax: String(baseMax),
        ratePension: String(ratePension),
        rateMedical: String(rateMedical),
        rateUnemployment: String(rateUnemployment),
        fixedMedicalPersonal:
          it.fixedMedicalPersonal != null
            ? String(it.fixedMedicalPersonal)
            : null,
      })
      .onConflictDoUpdate({
        target: [cityRuleSS.cityId, cityRuleSS.effectiveFrom],
        set: {
          currency,
          effectiveTo: ne,
          baseMin: String(baseMin),
          baseMax: String(baseMax),
          ratePension: String(ratePension),
          rateMedical: String(rateMedical),
          rateUnemployment: String(rateUnemployment),
          fixedMedicalPersonal:
            it.fixedMedicalPersonal != null
              ? String(it.fixedMedicalPersonal)
              : null,
        },
      });
  }
  await logAudit("RULE_SS_UPSERT", { meta: { count: items.length } });
  await markIdempotencyUsed(key);
  return NextResponse.json({ upserted: items.length });
}

function isOverlap(
  rule: CityRuleSS,
  nextStart: Date,
  nextEnd: Date | null,
): boolean {
  const existingStart = new Date(rule.effectiveFrom);
  const existingEnd = rule.effectiveTo ? new Date(rule.effectiveTo) : null;
  return (
    (nextEnd === null || existingStart < nextEnd) &&
    (existingEnd === null || nextStart < existingEnd)
  );
}

type RuleInput = {
  startDate?: string;
  endDate?: string | null;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  currency?: string | null;
};

function resolveEffectiveRange(
  rule: RuleInput,
): { effectiveFrom: Date; effectiveTo: Date | null } {
  const fromStr = rule.effectiveFrom ?? rule.startDate;
  if (!fromStr) throw new Error("effectiveFrom required");
  const effectiveFrom = new Date(fromStr);
  if (Number.isNaN(effectiveFrom.getTime()))
    throw new Error("invalid effectiveFrom");
  const toStr =
    rule.effectiveTo !== undefined ? rule.effectiveTo : rule.endDate;
  if (!toStr) return { effectiveFrom, effectiveTo: null };
  const effectiveTo = new Date(toStr);
  if (Number.isNaN(effectiveTo.getTime()))
    throw new Error("invalid effectiveTo");
  return { effectiveFrom, effectiveTo };
}

function resolveCurrency(currency?: string | null): string {
  if (!currency) return "CNY";
  const trimmed = currency.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(trimmed) ? trimmed : "CNY";
}

async function resolveCity(
  cityInput: string,
  country?: string,
): Promise<City | null> {
  const normalizedCountry = country ?? "CN";
  if (cityInput.length === 36) {
    const [found] = await db
      .select()
      .from(cities)
      .where(eq(cities.id, cityInput))
      .limit(1);
    return found ?? null;
  }
  const [city] = await db
    .insert(cities)
    .values({ name: cityInput, country: normalizedCountry })
    .onConflictDoUpdate({
      target: cities.name,
      set: { country: normalizedCountry },
    })
    .returning();
  return city ?? null;
}
