import { parseGjjFromHtml, parseSihfFromHtml } from "@/lib/sources/parsers";
import { type TaxParams, taxParamsSchema } from "@/lib/tax";

export interface FetchOptions {
  year: number;
  city?: string;
  allowNetwork?: boolean;
}

/**
 * Fetch Hangzhou tax and social insurance parameters.
 *
 * Network scraping is disabled by default and a curated fallback is returned.
 * To enable live fetching in the future, set allowNetwork=true and implement
 * source-specific parsers. The return value is validated by zod schema.
 */
export async function fetchHangzhouParams(options: FetchOptions): Promise<TaxParams> {
  const year = options.year;
  const city = options.city || "Hangzhou";

  // TODO: Implement live fetching from official websites when stable sources are confirmed.
  // Placeholder for future enablement:
  if (options.allowNetwork && process.env.ALLOW_NETWORK === "1") {
    try {
      // Example sources. In practice pass specific notice URLs via another API.
      const sihfUrl = process.env.HZ_SIHF_URL;
      const gjjUrl = process.env.HZ_GJJ_URL;
      let baseMin: number | undefined;
      let baseMax: number | undefined;
      let pension: number | undefined;
      let medical: number | undefined;
      let unemployment: number | undefined;
      let gjjRate: number | undefined;
      let gjjBaseMin: number | undefined;
      let gjjBaseMax: number | undefined;

      if (sihfUrl) {
        const res = await fetch(sihfUrl, { cache: "no-store" });
        const html = await res.text();
        const p = parseSihfFromHtml(html);
        baseMin = p.baseMin ?? baseMin;
        baseMax = p.baseMax ?? baseMax;
        pension = p.pensionRate ?? pension;
        medical = p.medicalRate ?? medical;
        unemployment = p.unemploymentRate ?? unemployment;
      }
      if (gjjUrl) {
        const res = await fetch(gjjUrl, { cache: "no-store" });
        const html = await res.text();
        const g = parseGjjFromHtml(html);
        gjjBaseMin = g.baseMin ?? gjjBaseMin;
        gjjBaseMax = g.baseMax ?? gjjBaseMax;
        // choose upper if in range, fallback lower
        gjjRate = g.rateUpper ?? g.rateLower ?? gjjRate;
      }

      if (baseMin && baseMax && pension) {
        const dynamic: TaxParams = {
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
            pension: pension,
            ...(medical ? { medical: medical } : {}),
            ...(unemployment ? { unemployment: unemployment } : {}),
          } as any,
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
          specialDeductions: { children: 1000 } as any,
        };
        return taxParamsSchema.parse(dynamic);
      }
    } catch (err) {
      // On any failure, fall back to curated defaults
      // console.warn("Live fetch failed, using fallback", err);
    }
  }

  const fallback: TaxParams = {
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
    // Employee-side sample rates; adjust as per official notices when scraping enabled
    sihfRates: {
      pension: 0.08,
      medical: 0.02,
      unemployment: 0.005,
    } as any,
    sihfBase: { min: 5000, max: 30000 },
    // Optional housing fund example (commonly 7%-12%, varies by employer)
    housingFund: { rate: 0.12, baseMin: 5000, baseMax: 30000 },
    specialDeductions: { children: 1000 } as any,
  };

  return taxParamsSchema.parse(fallback);
}
