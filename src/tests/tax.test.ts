import { describe, it, expect } from "vitest";
import { calcMonthlyWithholdingCumulative, TaxParams } from "@/lib/tax";

describe("tax cumulative withholding", () => {
  const params: TaxParams = {
    city: "Hangzhou",
    year: 2025,
    monthlyBasicDeduction: 5000,
    brackets: [
      { threshold: 0, rate: 0.03, quickDeduction: 0 },
      { threshold: 36000, rate: 0.1, quickDeduction: 2520 },
      { threshold: 144000, rate: 0.2, quickDeduction: 16920 },
    ],
    sihfRates: { pension: 0.08 },
    sihfBase: { min: 5000, max: 30000 },
    specialDeductions: { children: 1000 },
  };
  it("computes incremental tax", () => {
    const res = calcMonthlyWithholdingCumulative(
      [
        { month: 1, gross: 20000 },
        { month: 2, gross: 20000 },
      ],
      params
    );
    expect(res.length).toBe(2);
    expect(res[0].taxThisMonth).toBeGreaterThanOrEqual(0);
    expect(res[1].taxDueCumulative).toBeGreaterThan(res[0].taxDueCumulative);
  });
});
