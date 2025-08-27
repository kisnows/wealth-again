import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import { ensureIdempotent, markIdempotencyUsed } from "@/server/utils/idempotency";
import { logAudit } from "@/server/services/audit";

/**
 * GET /api/v1/rules/housing-fund?city=Hangzhou&on=2025-01-01
 * - 查询指定城市在某日期生效的公积金规则。
 * PUT /api/v1/rules/housing-fund
 * - 批量 upsert 公积金规则。
 * - 入参: Array<{ city: string|id, startDate: ISO, endDate?: ISO, baseMin, baseMax, rateEmployee }>
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cityName = searchParams.get("city");
  const on = searchParams.get("on");
  if (!cityName || !on) return NextResponse.json({ error: "city & on required" }, { status: 400 });
  const city = await prisma.city.findUnique({ where: { name: cityName } });
  if (!city) return NextResponse.json({ error: "city not found" }, { status: 404 });
  const onDate = new Date(on);
  const rule = await prisma.cityRuleHF.findFirst({ where: { cityId: city.id, startDate: { lte: onDate }, OR: [{ endDate: null }, { endDate: { gt: onDate } }] }, orderBy: { startDate: "desc" } });
  if (!rule) return NextResponse.json({ error: "No rule" }, { status: 404 });
  return NextResponse.json(rule);
}

export async function PUT(req: Request) {
  const items = await req.json();
  if (!Array.isArray(items)) return NextResponse.json({ error: "array body required" }, { status: 400 });
  const { key, existed } = await ensureIdempotent(req, undefined, `hf:${items.length}`);
  if (existed) return NextResponse.json({ error: "Idempotency key reused" }, { status: 409 });
  for (const it of items) {
    const city = typeof it.city === "string" && it.city.length !== 36 ? await prisma.city.upsert({ where: { name: it.city }, update: {}, create: { name: it.city, country: it.country || "CN" } }) : { id: it.city };
    const existing = await prisma.cityRuleHF.findMany({ where: { cityId: (city as any).id } });
    const ns = new Date(it.startDate);
    const ne: Date | null = it.endDate ? new Date(it.endDate) : null;
    const overlap = existing.some((r) => {
      const rs = new Date(r.startDate as any);
      const re: Date | null = (r.endDate ? new Date(r.endDate as any) : null);
      return (ne === null || rs < ne) && (re === null || ns < re);
    });
    if (overlap) return NextResponse.json({ error: "interval overlaps existing rule", city: (city as any).id }, { status: 409 });
    await prisma.cityRuleHF.upsert({
      where: { cityId_startDate: { cityId: city.id, startDate: new Date(it.startDate) } },
      update: {
        endDate: it.endDate ? new Date(it.endDate) : null,
        baseMin: it.baseMin,
        baseMax: it.baseMax,
        rateEmployee: it.rateEmployee,
      },
      create: {
        cityId: city.id,
        startDate: new Date(it.startDate),
        endDate: it.endDate ? new Date(it.endDate) : null,
        baseMin: it.baseMin,
        baseMax: it.baseMax,
        rateEmployee: it.rateEmployee,
      },
    });
  }
  await logAudit("RULE_HF_UPSERT", { meta: { count: items.length } });
  await markIdempotencyUsed(key);
  return NextResponse.json({ upserted: items.length });
}
