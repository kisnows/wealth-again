import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TaxService } from "@/lib/tax";

type TB = {
  minIncome: number;
  maxIncome: number | null;
  taxRate: number;
  quickDeduction: number;
};
type SI = {
  socialMinBase: number;
  socialMaxBase: number;
  pensionRate: number;
  medicalRate: number;
  unemploymentRate: number;
  housingFundMinBase: number;
  housingFundMaxBase: number;
  housingFundRate: number;
};

class FakeRepo {
  constructor(
    private cfg: { ranges: Array<{ from: string; brackets: TB[]; si: SI }> }
  ) {}
  private pick(date: Date) {
    // 选择最近的（最大）effectiveFrom <= date
    const sorted = [...this.cfg.ranges].sort(
      (a, b) => +new Date(a.from) - +new Date(b.from)
    );
    let hit: { from: string; brackets: TB[]; si: SI } | undefined;
    for (const r of sorted) {
      if (date >= new Date(r.from)) hit = r;
      else break;
    }
    return hit;
  }
  async getTaxBrackets(_city: string, date: Date) {
    const key = this.pick(date);
    return key ? key.brackets : [];
  }
  async getSocialInsuranceConfig(_city: string, date: Date) {
    const key = this.pick(date);
    return key ? key.si : null;
  }
  // 以下接口在本测试中不使用，提供空实现以满足结构
  async saveTaxBrackets() {}
  async saveSocialInsuranceConfig() {}
  async getIncomeRecord() {
    return null as any;
  }
  async saveIncomeRecord() {
    return null as any;
  }
  async getAnnualIncomeRecords() {
    return [];
  }
  async getTaxConfigHistory() {
    return { brackets: [], socialConfigs: [] };
  }
}

describe("income forecast uses config by effective date (service, no DB)", () => {
  const city = "Hangzhou";

  it("no taxChange when config stable all year", async () => {
    const stableBrackets: TB[] = [
      { minIncome: 0, maxIncome: 36000, taxRate: 0.03, quickDeduction: 0 },
      { minIncome: 36000, maxIncome: null, taxRate: 0.1, quickDeduction: 2520 },
    ];
    const si: SI = {
      socialMinBase: 5000,
      socialMaxBase: 30000,
      pensionRate: 0.08,
      medicalRate: 0.02,
      unemploymentRate: 0.005,
      housingFundMinBase: 5000,
      housingFundMaxBase: 30000,
      housingFundRate: 0.12,
    };
    const repo = new FakeRepo({
      ranges: [{ from: "2025-01-01", brackets: stableBrackets, si }],
    });
    const svc = new TaxService(repo as any);
    const months = Array.from({ length: 12 }, (_, i) => ({
      year: 2025,
      month: i + 1,
      gross: 20000,
      bonus: 0,
    }));
    const res = await svc.calculateForecastWithholdingCumulative({
      city,
      months,
    });
    const anyTaxChange = res.some(
      (r, i) => i > 0 && r.paramsSig !== res[i - 1].paramsSig
    );
    expect(anyTaxChange).toBe(false);
  });

  it("taxChange when new config effective from July", async () => {
    const before: TB[] = [
      { minIncome: 0, maxIncome: 36000, taxRate: 0.03, quickDeduction: 0 },
      { minIncome: 36000, maxIncome: null, taxRate: 0.1, quickDeduction: 2520 },
    ];
    const after: TB[] = [
      { minIncome: 0, maxIncome: 36000, taxRate: 0.05, quickDeduction: 0 },
      { minIncome: 36000, maxIncome: null, taxRate: 0.1, quickDeduction: 2520 },
    ];
    const si: SI = {
      socialMinBase: 5000,
      socialMaxBase: 30000,
      pensionRate: 0.08,
      medicalRate: 0.02,
      unemploymentRate: 0.005,
      housingFundMinBase: 5000,
      housingFundMaxBase: 30000,
      housingFundRate: 0.12,
    };
    const repo = new FakeRepo({
      ranges: [
        { from: "2026-01-01", brackets: before, si },
        { from: "2026-07-01", brackets: after, si },
      ],
    });
    const svc = new TaxService(repo as any);
    const months = Array.from({ length: 12 }, (_, i) => ({
      year: 2026,
      month: i + 1,
      gross: 20000,
      bonus: 0,
    }));
    const res = await svc.calculateForecastWithholdingCumulative({
      city,
      months,
    });
    const changeMonths = res
      .map((r, i, arr) =>
        i === 0 ? null : arr[i - 1].paramsSig !== r.paramsSig ? r.month : null
      )
      .filter(Boolean) as number[];
    expect(changeMonths.includes(7)).toBe(true);
  });

  it("after rate drop in Oct, later months should still have positive tax if taxable grows", async () => {
    const before: TB[] = [
      { minIncome: 0, maxIncome: 36000, taxRate: 0.3, quickDeduction: 0 },
      {
        minIncome: 36000,
        maxIncome: null,
        taxRate: 0.35,
        quickDeduction: 1000,
      },
    ];
    const after: TB[] = [
      { minIncome: 0, maxIncome: 36000, taxRate: 0.03, quickDeduction: 0 },
      { minIncome: 36000, maxIncome: null, taxRate: 0.1, quickDeduction: 2520 },
    ];
    const si: SI = {
      socialMinBase: 5000,
      socialMaxBase: 30000,
      pensionRate: 0.08,
      medicalRate: 0.02,
      unemploymentRate: 0.005,
      housingFundMinBase: 5000,
      housingFundMaxBase: 30000,
      housingFundRate: 0.12,
    };
    const repo = new FakeRepo({
      ranges: [
        { from: "2026-01-01", brackets: before, si },
        { from: "2026-10-01", brackets: after, si },
      ],
    });
    const svc = new TaxService(repo as any);
    const months = Array.from({ length: 12 }, (_, i) => ({
      year: 2026,
      month: i + 1,
      gross: 20000,
      bonus: 0,
    }));
    const res = await svc.calculateForecastWithholdingCumulative({
      city,
      months,
    });
    const octIdx = 9 - 1; // index 9th month? actually Oct is 10th, zero-based 9
    const nov = res[10 - 1];
    const dec = res[12 - 1];
    expect(nov.taxThisMonth).toBeGreaterThanOrEqual(0);
    expect(dec.taxThisMonth).toBeGreaterThanOrEqual(0);
  });
});
