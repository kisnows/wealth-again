import type { City, CityRuleSS } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import { logAudit } from "@/server/services/audit";
import {
  ensureIdempotent,
  markIdempotencyUsed,
} from "@/server/utils/idempotency";

/**
 * GET /api/v1/rules/social-security?city=Hangzhou&on=2025-01-01
 * - 查询指定城市在某日期生效的社保规则。
 * PUT /api/v1/rules/social-security
 * - 批量 upsert 社保规则。
 * - 入参: Array<{ city: string|id, startDate: ISO, endDate?: ISO, baseMin, baseMax, ratePension, rateMedical, rateUnemployment, fixedMedicalPersonal?: number }>
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cityName = searchParams.get("city");
  const on = searchParams.get("on");
  if (!cityName || !on)
    return NextResponse.json({ error: "city & on required" }, { status: 400 });
  const city = await prisma.city.findUnique({ where: { name: cityName } });
  if (!city)
    return NextResponse.json({ error: "city not found" }, { status: 404 });
  const onDate = new Date(on);
  const rule = await prisma.cityRuleSS.findFirst({
    where: {
      cityId: city.id,
      startDate: { lte: onDate },
      OR: [{ endDate: null }, { endDate: { gt: onDate } }],
    },
    orderBy: { startDate: "desc" },
  });
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
    const existing = await prisma.cityRuleSS.findMany({
      where: { cityId: city.id },
    });
    const ns = new Date(it.startDate);
    const ne: Date | null = it.endDate ? new Date(it.endDate) : null;
    const overlap = existing.some((r) => isOverlap(r, ns, ne));
    if (overlap)
      return NextResponse.json(
        { error: "interval overlaps existing rule", city: city.id },
        { status: 409 },
      );
    await prisma.cityRuleSS.upsert({
      where: {
        cityId_startDate: {
          cityId: city.id,
          startDate: new Date(it.startDate),
        },
      },
      update: {
        endDate: it.endDate ? new Date(it.endDate) : null,
        baseMin: it.baseMin,
        baseMax: it.baseMax,
        ratePension: it.ratePension,
        rateMedical: it.rateMedical,
        rateUnemployment: it.rateUnemployment,
        fixedMedicalPersonal: it.fixedMedicalPersonal ?? null,
      },
      create: {
        cityId: city.id,
        startDate: new Date(it.startDate),
        endDate: it.endDate ? new Date(it.endDate) : null,
        baseMin: it.baseMin,
        baseMax: it.baseMax,
        ratePension: it.ratePension,
        rateMedical: it.rateMedical,
        rateUnemployment: it.rateUnemployment,
        fixedMedicalPersonal: it.fixedMedicalPersonal ?? null,
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
  const existingStart = new Date(rule.startDate);
  const existingEnd = rule.endDate ? new Date(rule.endDate) : null;
  return (
    (nextEnd === null || existingStart < nextEnd) &&
    (existingEnd === null || nextStart < existingEnd)
  );
}

async function resolveCity(
  cityInput: string,
  country?: string,
): Promise<City | null> {
  const normalizedCountry = country ?? "CN";
  if (cityInput.length === 36) {
    return prisma.city.findUnique({ where: { id: cityInput } });
  }
  return prisma.city.upsert({
    where: { name: cityInput },
    update: {},
    create: { name: cityInput, country: normalizedCountry },
  });
}
