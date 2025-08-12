import { describe, it, expect } from "vitest";
import { normalizeTaxParamsValue, TaxParams } from "@/lib/tax";

describe("normalizeTaxParamsValue", () => {
  const sample: TaxParams = {
    city: "Hangzhou",
    year: 2025,
    monthlyBasicDeduction: 5000,
    brackets: [{ threshold: 0, rate: 0.03, quickDeduction: 0 }],
    sihfRates: { pension: 0.08 },
    sihfBase: { min: 5000, max: 30000 },
    specialDeductions: { children: 1000 },
  };

  it("accepts object", () => {
    const got = normalizeTaxParamsValue(sample);
    expect(got.city).toBe("Hangzhou");
    expect(got.year).toBe(2025);
  });

  it("accepts JSON string", () => {
    const got = normalizeTaxParamsValue(JSON.stringify(sample));
    expect(got.city).toBe("Hangzhou");
    expect(got.sihfBase.max).toBe(30000);
  });
});
