import { describe, expect, it } from "vitest";
import { TaxService } from "@/lib/tax";

describe("tax cumulative withholding (service)", () => {
  it("computes incremental tax", async () => {
    const city = "Hangzhou";
    const repo = new (class {
      brackets = [
        { minIncome: 0, maxIncome: 36000, taxRate: 0.03, quickDeduction: 0 },
        {
          minIncome: 36000,
          maxIncome: 144000,
          taxRate: 0.1,
          quickDeduction: 2520,
        },
        {
          minIncome: 144000,
          maxIncome: null,
          taxRate: 0.2,
          quickDeduction: 16920,
        },
      ];
      si = {
        socialMinBase: 5000,
        socialMaxBase: 30000,
        pensionRate: 0.08,
        medicalRate: 0.02,
        unemploymentRate: 0.005,
        housingFundMinBase: 5000,
        housingFundMaxBase: 30000,
        housingFundRate: 0.12,
      };
      async getTaxBrackets() {
        return this.brackets;
      }
      async getSocialInsuranceConfig() {
        return this.si;
      }
    })() as any;
    const svc = new TaxService(repo);
    const res = await svc.calculateForecastWithholdingCumulative({
      userId: "test-user",
      months: [
        { year: 2025, month: 1, gross: 20000 },
        { year: 2025, month: 2, gross: 20000 },
      ],
    });
    expect(res.length).toBe(2);
    expect(res[0].taxThisMonth).toBeGreaterThanOrEqual(0);
    expect(res[1].taxThisMonth).toBeGreaterThanOrEqual(0);
  });
});
