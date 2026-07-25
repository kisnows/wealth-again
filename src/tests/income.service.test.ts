import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  insertCalls,
  resetDbMock,
  setSelectFallback,
} from "@/tests/helpers/dbMock";
import {
  bonusPlans,
  cities,
  cityRuleHF,
  cityRuleSS,
  equityVests,
  incomeChanges,
  incomeRecords,
  longTermCashPayouts,
  taxBracket,
  taxConfig,
  users,
} from "@/server/db/schema";

const writeOutboxEventMock = vi.fn().mockResolvedValue({ id: "evt" });
vi.mock("@/server/services/outbox", () => ({
  writeOutboxEvent: writeOutboxEventMock,
  writeOutboxEventSync: vi.fn(),
  fetchPendingOutboxEvents: vi.fn(),
  markOutboxEventDelivered: vi.fn(),
  markOutboxEventFailed: vi.fn(),
}));

describe("Income service · recalcIncome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMock();
    writeOutboxEventMock.mockReset();
    setSelectFallback(null);
  });

  beforeEach(async () => {
    const { clearTaxContextCache } = await import(
      "@/server/services/income-tax/tax"
    );
    clearTaxContextCache();
  });

  it("clamps social/housing bases, picks last salary of the month, and persists cumulative tax metrics", async () => {
    // 用例：工资同月多次变更、城市规则换档、奖金与长期现金叠加时，需正确取当月最新工资、
    //       按上下限 clamp 社保/公积金基数，并写回累计应税与累计个税指标。
    const salaryHistory = [
      { grossMonthly: "4000", currency: "CNY" },
      { grossMonthly: "15000", currency: "CNY" },
      { grossMonthly: "20000", currency: "CNY" },
    ];
    const monthlyBonuses = [[], [], [{ amount: "3000" }]];
    const monthlyLtc = [[], [], [{ amount: "5000" }]];
    const ssRules = [
      {
        baseMin: "5000",
        baseMax: "15000",
        ratePension: "0.08",
        rateMedical: "0.02",
        rateUnemployment: "0.005",
        fixedMedicalPersonal: "3",
      },
      {
        baseMin: "5000",
        baseMax: "18000",
        ratePension: "0.08",
        rateMedical: "0.02",
        rateUnemployment: "0.005",
        fixedMedicalPersonal: "3",
      },
    ];
    const hfRules = [
      {
        baseMin: "5000",
        baseMax: "15000",
        rateEmployee: "0.12",
      },
      {
        baseMin: "5000",
        baseMax: "18000",
        rateEmployee: "0.12",
      },
    ];
    setSelectFallback(({ table, tableCallIndex }) => {
      if (table === users) {
        return [{ id: "u-income", currentCityId: "hz" }];
      }
      if (table === cities) {
        return [{ id: "hz", country: "CN" }];
      }
      if (table === incomeChanges) {
        return [
          salaryHistory[tableCallIndex] ??
            salaryHistory[salaryHistory.length - 1],
        ];
      }
      if (table === bonusPlans) {
        return monthlyBonuses[tableCallIndex] ?? [];
      }
      if (table === longTermCashPayouts) {
        return monthlyLtc[tableCallIndex] ?? [];
      }
      if (table === equityVests) {
        return [];
      }
      if (table === cityRuleSS) {
        return [ssRules[Math.min(tableCallIndex, ssRules.length - 1)]];
      }
      if (table === cityRuleHF) {
        return [hfRules[Math.min(tableCallIndex, hfRules.length - 1)]];
      }
      if (table === taxConfig) {
        return [
          {
            country: "CN",
            taxYear: 2025,
            standardDeduction: "5000",
            specialAdditionalDeduction: "200",
          },
        ];
      }
      if (table === taxBracket) {
        return [
          {
            position: 1,
            threshold: "36000",
            taxRate: "0.03",
            quickDeduction: "0",
          },
          {
            position: 2,
            threshold: "144000",
            taxRate: "0.1",
            quickDeduction: "2520",
          },
          {
            position: 3,
            threshold: "300000",
            taxRate: "0.2",
            quickDeduction: "16920",
          },
          {
            position: 4,
            threshold: "420000",
            taxRate: "0.25",
            quickDeduction: "31920",
          },
          {
            position: 5,
            threshold: "660000",
            taxRate: "0.3",
            quickDeduction: "52920",
          },
          {
            position: 6,
            threshold: "960000",
            taxRate: "0.35",
            quickDeduction: "85920",
          },
          {
            position: 7,
            threshold: "1000000000",
            taxRate: "0.45",
            quickDeduction: "181920",
          },
        ];
      }
      return [];
    });
    const brackets = [
      { position: 1, threshold: 36000, taxRate: 0.03, quickDeduction: 0 },
      { position: 2, threshold: 144000, taxRate: 0.1, quickDeduction: 2520 },
      { position: 3, threshold: 300000, taxRate: 0.2, quickDeduction: 16920 },
      {
        position: 4,
        threshold: 420000,
        taxRate: 0.25,
        quickDeduction: 31920,
      },
      { position: 5, threshold: 660000, taxRate: 0.3, quickDeduction: 52920 },
      { position: 6, threshold: 960000, taxRate: 0.35, quickDeduction: 85920 },
      {
        position: 7,
        threshold: 1000000000,
        taxRate: 0.45,
        quickDeduction: 181920,
      },
    ];
    const { recalcIncome } = await import(
      "@/server/services/income-tax/income"
    );
    const result = await recalcIncome({ taxYear: 2025, endMonth: 3 });
    expect(result.updated).toBe(3);
    const monthly: Record<number, any> = {};
    for (const call of insertCalls) {
      if (call.table !== incomeRecords) continue;
      const values = call.values as { monthDate: Date } & Record<
        string,
        string
      >;
      const month = values.monthDate.getUTCMonth() + 1;
      monthly[month] = values;
    }

    expect(Number(monthly[1].gross)).toBe(4000);
    expect(Number(monthly[1].socialInsurance)).toBeCloseTo(528, 2);
    expect(Number(monthly[1].housingFund)).toBeCloseTo(600, 2);
    expect(Number(monthly[1].taxableCurrent)).toBeCloseTo(0, 2);
    expect(Number(monthly[1].taxableCumulative)).toBeCloseTo(0, 2);
    expect(Number(monthly[1].incomeTax)).toBeCloseTo(0, 2);
    expect(Number(monthly[1].taxPaidCumulative)).toBeCloseTo(0, 2);
    expect(Number(monthly[1].taxCumulative)).toBeCloseTo(0, 2);
    expect(Number(monthly[1].netIncome)).toBeCloseTo(2872, 2);

    expect(Number(monthly[2].gross)).toBe(15000);
    expect(Number(monthly[2].taxableCurrent)).toBeCloseTo(6422, 2);
    expect(Number(monthly[2].taxableCumulative)).toBeCloseTo(6422, 2);
    expect(Number(monthly[2].incomeTax)).toBeCloseTo(192.66, 2);
    expect(Number(monthly[2].taxPaidCumulative)).toBeCloseTo(192.66, 2);
    expect(Number(monthly[2].taxCumulative)).toBeCloseTo(192.66, 2);
    expect(Number(monthly[2].netIncome)).toBeCloseTo(11429.34, 2);

    expect(Number(monthly[3].gross)).toBe(20000);
    expect(Number(monthly[3].bonus)).toBe(3000);
    expect(Number(monthly[3].ltcIncome)).toBe(5000);
    expect(Number(monthly[3].socialInsurance)).toBeCloseTo(1893, 2);
    expect(Number(monthly[3].housingFund)).toBeCloseTo(2160, 2);
    expect(Number(monthly[3].taxableCurrent)).toBeCloseTo(18747, 2);
    expect(Number(monthly[3].taxableCumulative)).toBeCloseTo(25169, 2);
    expect(Number(monthly[3].incomeTax)).toBeCloseTo(562.41, 2);
    expect(Number(monthly[3].taxPaidCumulative)).toBeCloseTo(755.07, 2);
    expect(Number(monthly[3].taxCumulative)).toBeCloseTo(755.07, 2);
    expect(Number(monthly[3].netIncome)).toBeCloseTo(23384.59, 2);
  });

  it("matches PRD 2025-01~03 baseline: tax, social insurance, housing fund, net pay", async () => {
    // 用例：对照 PRD 附录（doc/prd-income.md）1~3 月样例，验证累计预扣个税公式与社保/公积金扣除。
    const monthlyBonuses = [[], [], [{ amount: "30000" }]];
    const monthlyLtc = [[{ amount: "10000" }], [], [{ amount: "10000" }]];
    setSelectFallback(({ table, tableCallIndex }) => {
      if (table === users) {
        return [{ id: "u1", currentCityId: "hz" }];
      }
      if (table === cities) {
        return [{ id: "hz", country: "CN" }];
      }
      if (table === incomeChanges) {
        return [{ grossMonthly: "20000", currency: "CNY" }];
      }
      if (table === bonusPlans) {
        return monthlyBonuses[tableCallIndex] ?? [];
      }
      if (table === longTermCashPayouts) {
        return monthlyLtc[tableCallIndex] ?? [];
      }
      if (table === equityVests) {
        return [];
      }
      if (table === cityRuleSS) {
        return [
          {
            baseMin: "5000",
            baseMax: "25000",
            ratePension: "0.08",
            rateMedical: "0.02",
            rateUnemployment: "0.005",
            fixedMedicalPersonal: "3",
          },
        ];
      }
      if (table === cityRuleHF) {
        return [
          {
            baseMin: "5000",
            baseMax: "25000",
            rateEmployee: "0.12",
          },
        ];
      }
      if (table === taxConfig) {
        return [
          {
            country: "CN",
            taxYear: 2025,
            standardDeduction: "5000",
            specialAdditionalDeduction: "0",
          },
        ];
      }
      if (table === taxBracket) {
        return [
          {
            position: 1,
            threshold: "36000",
            taxRate: "0.03",
            quickDeduction: "0",
          },
          {
            position: 2,
            threshold: "144000",
            taxRate: "0.1",
            quickDeduction: "2520",
          },
          {
            position: 3,
            threshold: "300000",
            taxRate: "0.2",
            quickDeduction: "16920",
          },
          {
            position: 4,
            threshold: "420000",
            taxRate: "0.25",
            quickDeduction: "31920",
          },
          {
            position: 5,
            threshold: "660000",
            taxRate: "0.3",
            quickDeduction: "52920",
          },
          {
            position: 6,
            threshold: "960000",
            taxRate: "0.35",
            quickDeduction: "85920",
          },
          {
            position: 7,
            threshold: "1000000000",
            taxRate: "0.45",
            quickDeduction: "181920",
          },
        ];
      }
      return [];
    });

    const { recalcIncome } = await import(
      "@/server/services/income-tax/income"
    );
    await recalcIncome({ taxYear: 2025, endMonth: 3 });

    const monthly: Record<number, any> = {};
    for (const call of insertCalls) {
      if (call.table !== incomeRecords) continue;
      const values = call.values as { monthDate: Date } & Record<
        string,
        string
      >;
      const month = values.monthDate.getUTCMonth() + 1;
      monthly[month] = values;
    }

    expect(Number(monthly[1].socialInsurance)).toBeCloseTo(2103, 2);
    expect(Number(monthly[1].housingFund)).toBeCloseTo(2400, 2);
    expect(Number(monthly[1].incomeTax)).toBeCloseTo(614.91, 2);
    expect(Number(monthly[1].netIncome)).toBeCloseTo(24882.09, 2);

    expect(Number(monthly[2].incomeTax)).toBeCloseTo(314.91, 2);
    expect(Number(monthly[2].netIncome)).toBeCloseTo(15182.09, 2);

    expect(Number(monthly[3].bonus)).toBeCloseTo(30000, 2);
    expect(Number(monthly[3].ltcIncome)).toBeCloseTo(10000, 2);
    expect(Number(monthly[3].incomeTax)).toBeCloseTo(4699.28, 2);
    expect(Number(monthly[3].netIncome)).toBeCloseTo(50797.72, 2);
  });
});
