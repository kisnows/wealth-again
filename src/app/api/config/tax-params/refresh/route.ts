import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createTaxService } from "@/lib/tax";
import { fetchHangzhouParams } from "@/lib/sources/hz-params";
import { parseSihfFromHtml, parseGjjFromHtml } from "@/lib/sources/parsers";
import { taxParamsSchema } from "@/lib/tax";

const taxService = createTaxService(prisma);

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    city?: string;
    year?: number;
    sihfUrl?: string;
    gjjUrl?: string;
  };
  const city = body.city || "Hangzhou";
  const year = body.year || new Date().getFullYear();

  // Strict: if URLs are provided, must parse successfully, otherwise 422
  let params;
  if (body.sihfUrl || body.gjjUrl) {
    try {
      let baseMin: number | undefined;
      let baseMax: number | undefined;
      let pension: number | undefined;
      let medical: number | undefined;
      let unemployment: number | undefined;
      let gjjRate: number | undefined;
      let gjjBaseMin: number | undefined;
      let gjjBaseMax: number | undefined;

      if (body.sihfUrl) {
        const res = await fetch(body.sihfUrl, { cache: "no-store" });
        const html = await res.text();
        const p = parseSihfFromHtml(html);
        baseMin = p.baseMin;
        baseMax = p.baseMax;
        pension = p.pensionRate;
        medical = p.medicalRate;
        unemployment = p.unemploymentRate;
      }
      if (body.gjjUrl) {
        const res = await fetch(body.gjjUrl, { cache: "no-store" });
        const html = await res.text();
        const g = parseGjjFromHtml(html);
        gjjBaseMin = g.baseMin;
        gjjBaseMax = g.baseMax;
        gjjRate = g.rateUpper ?? g.rateLower;
      }

      if (!baseMin || !baseMax || !pension) {
        return NextResponse.json(
          { error: "parse_failed", details: { baseMin, baseMax, pension } },
          { status: 422 }
        );
      }

      params = taxParamsSchema.parse({
        city,
        year,
        monthlyBasicDeduction: 5000,
        brackets: [
          { threshold: 0, rate: 0.03, quickDeduction: 0 },
          { threshold: 36000, rate: 0.1, quickDeduction: 2520 },
          { threshold: 144000, rate: 0.2, quickDeduction: 16920 },
          { threshold: 300000, rate: 0.25, quickDeduction: 31920 },
          { threshold: 420000, rate: 0.3, quickDeduction: 52920 },
          { threshold: 660000, rate: 0.35, quickDeduction: 85920 },
          { threshold: 960000, rate: 0.45, quickDeduction: 181920 },
        ],
        sihfRates: {
          pension,
          ...(medical ? { medical } : {}),
          ...(unemployment ? { unemployment } : {}),
        },
        sihfBase: { min: baseMin, max: baseMax },
        ...(gjjRate && (gjjBaseMin || gjjBaseMax)
          ? {
              housingFund: {
                rate: gjjRate,
                baseMin: gjjBaseMin ?? baseMin,
                baseMax: gjjBaseMax ?? baseMax,
              },
            }
          : {}),
        specialDeductions: { children: 1000 },
      });
    } catch (e) {
      return NextResponse.json({ error: "parse_error" }, { status: 422 });
    }
  } else {
    params = await fetchHangzhouParams({ year, city, allowNetwork: true });
  }

  // 使用新的税务服务保存参数
  try {
    await taxService.importHangzhouParams(params);
  } catch (error) {
    console.warn("Failed to save to new tax system:", error);
  }

  // 同时保存到旧的Config表（向后兼容）
  const key = `tax:${city}:${year}`;
  const rec = await prisma.config.create({
    data: {
      key,
      value: JSON.stringify(params),
      effectiveFrom: new Date(`${year}-01-01`),
    },
  });

  return NextResponse.json({
    id: rec.id,
    key,
    params,
    message: "参数已刷新并保存到新的税务配置系统",
  });
}
