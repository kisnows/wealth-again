import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma: any = {
  user: { findMany: vi.fn() },
  incomeChange: { findFirst: vi.fn() },
  bonusPlan: { findMany: vi.fn() },
  longTermCashPayout: { findMany: vi.fn() },
  equityVest: { findMany: vi.fn() },
  cityRuleSS: { findFirst: vi.fn() },
  cityRuleHF: { findFirst: vi.fn() },
  taxConfig: { findUnique: vi.fn() },
  taxBracket: { findMany: vi.fn() },
  incomeRecord: { upsert: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  userAnnualDeduction: { findUnique: vi.fn() },
};

vi.mock("@/server/db", () => ({ default: mockPrisma }));

describe("Income service · recalcIncome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const group of Object.values(mockPrisma)) {
      if (group && typeof group === "object") {
        for (const fnName of Object.keys(group)) {
          group[fnName].mockClear?.();
          group[fnName].mockReset?.();
        }
      }
    }
    mockPrisma.userAnnualDeduction.findUnique.mockResolvedValue(null);
    mockPrisma.incomeRecord.findFirst.mockResolvedValue(null);
  });

  it("clamps social/housing bases, picks last salary of the month, and persists cumulative tax metrics", async () => {
    // 用例：工资同月多次变更、城市规则换档、奖金与长期现金叠加时，需正确取当月最新工资、
    //       按上下限 clamp 社保/公积金基数，并写回累计应税与累计个税指标。
    const salaryHistory = [
      { effectiveFrom: new Date("2025-01-01"), grossMonthly: 4000 },
      { effectiveFrom: new Date("2025-02-01"), grossMonthly: 10000 },
      { effectiveFrom: new Date("2025-02-15"), grossMonthly: 15000 },
      { effectiveFrom: new Date("2025-03-20"), grossMonthly: 20000 },
    ];
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "u-income",
        baseCurrency: "CNY",
        currentCityId: "hz",
        currentCity: { country: "CN" },
      },
    ]);
    mockPrisma.incomeChange.findFirst.mockImplementation(
      async ({ where }: any) => {
        const nextMonth = where.effectiveFrom.lt as Date;
        const candidates = salaryHistory
          .filter((entry) => entry.effectiveFrom < nextMonth)
          .sort(
            (a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime(),
          );
        return candidates[0] ?? null;
      },
    );
    const bonusPlans = [
      { effectiveDate: new Date("2025-03-15"), amount: 3000 },
    ];
    mockPrisma.bonusPlan.findMany.mockImplementation(async ({ where }: any) => {
      const from: Date = where.effectiveDate.gte;
      const to: Date = where.effectiveDate.lt;
      return bonusPlans.filter(
        (plan) => plan.effectiveDate >= from && plan.effectiveDate < to,
      );
    });
    const ltcPayouts = [
      { payDate: new Date("2025-03-05"), amount: 5000 },
    ];
    mockPrisma.longTermCashPayout.findMany.mockImplementation(
      async ({ where }: any) => {
        const from: Date = where.payDate.gte;
        const to: Date = where.payDate.lt;
        return ltcPayouts.filter(
          (payout) => payout.payDate >= from && payout.payDate < to,
        );
      },
    );
    mockPrisma.equityVest.findMany.mockResolvedValue([]);
    const ssRules = [
      {
        startDate: new Date("2024-01-01"),
        endDate: new Date("2025-03-01"),
        baseMin: 5000,
        baseMax: 15000,
        ratePension: 0.08,
        rateMedical: 0.02,
        rateUnemployment: 0.005,
        fixedMedicalPersonal: 3,
      },
      {
        startDate: new Date("2025-03-01"),
        endDate: null,
        baseMin: 5000,
        baseMax: 18000,
        ratePension: 0.08,
        rateMedical: 0.02,
        rateUnemployment: 0.005,
        fixedMedicalPersonal: 3,
      },
    ];
    mockPrisma.cityRuleSS.findFirst.mockImplementation(async ({ where }: any) => {
      const monthDate: Date = where.startDate.lte;
      const candidates = ssRules
        .filter(
          (rule) =>
            rule.startDate <= monthDate &&
            (!rule.endDate || rule.endDate > monthDate),
        )
        .sort(
          (a, b) => b.startDate.getTime() - a.startDate.getTime(),
        );
      return candidates[0] ?? null;
    });
    const hfRules = [
      {
        startDate: new Date("2024-01-01"),
        endDate: new Date("2025-03-01"),
        baseMin: 5000,
        baseMax: 15000,
        rateEmployee: 0.12,
      },
      {
        startDate: new Date("2025-03-01"),
        endDate: null,
        baseMin: 5000,
        baseMax: 18000,
        rateEmployee: 0.12,
      },
    ];
    mockPrisma.cityRuleHF.findFirst.mockImplementation(async ({ where }: any) => {
      const monthDate: Date = where.startDate.lte;
      const candidates = hfRules
        .filter(
          (rule) =>
            rule.startDate <= monthDate &&
            (!rule.endDate || rule.endDate > monthDate),
        )
        .sort(
          (a, b) => b.startDate.getTime() - a.startDate.getTime(),
        );
      return candidates[0] ?? null;
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
    mockPrisma.taxConfig.findUnique.mockResolvedValue({
      country: "CN",
      taxYear: 2025,
      standardDeduction: 5000,
      specialAdditionalDeduction: 200,
      brackets: brackets.map((b) => ({ ...b })),
    });
    mockPrisma.userAnnualDeduction.findUnique.mockResolvedValue(null);
    mockPrisma.taxBracket.findMany.mockImplementation(async () =>
      brackets.map((b) => ({ ...b })),
    );
    const upserts: any[] = [];
    mockPrisma.incomeRecord.upsert.mockImplementation(async (args: any) => {
      upserts.push(args);
      return args;
    });
    mockPrisma.incomeRecord.findMany.mockResolvedValue([]);

    const { recalcIncome } = await import("@/server/services/income");
    const result = await recalcIncome({ taxYear: 2025, endMonth: 3 });
    expect(result.updated).toBe(3);
    expect(upserts).toHaveLength(3);

    const monthly: Record<number, any> = {};
    for (const call of upserts) {
      const month =
        call.where.userId_monthDate.monthDate.getUTCMonth() + 1;
      monthly[month] = call.update ?? call.create;
    }

    expect(monthly[1].gross).toBe(4000);
    expect(monthly[1].socialInsurance).toBeCloseTo(528, 2);
    expect(monthly[1].housingFund).toBeCloseTo(600, 2);
    expect(monthly[1].taxableIncome).toBe(0);
    expect(monthly[1].taxableCumulative).toBe(0);
    expect(monthly[1].incomeTax).toBeCloseTo(0, 2);
    expect(monthly[1].taxPaid).toBeCloseTo(0, 2);
    expect(monthly[1].taxCumulative).toBeCloseTo(0, 2);
    expect(monthly[1].netIncome).toBeCloseTo(2872, 2);

    expect(monthly[2].gross).toBe(15000);
    expect(monthly[2].taxableIncome).toBeCloseTo(6422, 2);
    expect(monthly[2].taxableCumulative).toBeCloseTo(6422, 2);
    expect(monthly[2].incomeTax).toBeCloseTo(192.66, 2);
    expect(monthly[2].taxPaid).toBeCloseTo(192.66, 2);
    expect(monthly[2].taxCumulative).toBeCloseTo(192.66, 2);
    expect(monthly[2].netIncome).toBeCloseTo(11429.34, 2);

    expect(monthly[3].gross).toBe(20000);
    expect(monthly[3].bonus).toBe(3000);
    expect(monthly[3].ltcIncome).toBe(5000);
    expect(monthly[3].socialInsurance).toBeCloseTo(1893, 2);
    expect(monthly[3].housingFund).toBeCloseTo(2160, 2);
    expect(monthly[3].taxableIncome).toBeCloseTo(18747, 2);
    expect(monthly[3].taxableCumulative).toBeCloseTo(25169, 2);
    expect(monthly[3].incomeTax).toBeCloseTo(562.41, 2);
    expect(monthly[3].taxPaid).toBeCloseTo(755.07, 2);
    expect(monthly[3].taxCumulative).toBeCloseTo(755.07, 2);
    expect(monthly[3].netIncome).toBeCloseTo(23384.59, 2);
  });

  it("matches PRD 2025-01~03 baseline: tax, social insurance, housing fund, net pay", async () => {
    // 用例：对照 PRD 附录（doc/prd-income.md）1~3 月样例，验证累计预扣个税公式与社保/公积金扣除。
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "u1",
        baseCurrency: "CNY",
        currentCityId: "hz",
        currentCity: { country: "CN" },
      },
    ]);
    mockPrisma.incomeChange.findFirst.mockResolvedValue({
      grossMonthly: 20000,
    });
    mockPrisma.bonusPlan.findMany.mockImplementation(({ where }: any) => {
      const start: Date = where.effectiveDate.gte;
      return start.getUTCMonth() === 2 ? [{ amount: 30000 }] : [];
    });
    mockPrisma.longTermCashPayout.findMany.mockImplementation(
      ({ where }: any) => {
        const start: Date = where.payDate.gte;
        const month = start.getUTCMonth();
        return month === 0 || month === 2 ? [{ amount: 10000 }] : [];
      },
    );
    mockPrisma.equityVest.findMany.mockResolvedValue([]);
    mockPrisma.cityRuleSS.findFirst.mockResolvedValue({
      baseMin: 5000,
      baseMax: 25000,
      ratePension: 0.08,
      rateMedical: 0.02,
      rateUnemployment: 0.005,
      fixedMedicalPersonal: 3,
    });
    mockPrisma.cityRuleHF.findFirst.mockResolvedValue({
      baseMin: 5000,
      baseMax: 25000,
      rateEmployee: 0.12,
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
    mockPrisma.taxConfig.findUnique.mockResolvedValue({
      country: "CN",
      taxYear: 2025,
      standardDeduction: 5000,
      specialAdditionalDeduction: 0,
      brackets: brackets.map((b) => ({ ...b })),
    });
    mockPrisma.taxBracket.findMany.mockImplementation(async () =>
      brackets.map((b) => ({ ...b })),
    );
    const upserts: any[] = [];
    mockPrisma.incomeRecord.upsert.mockImplementation(async (args: any) => {
      upserts.push(args);
      return args;
    });

    const { recalcIncome } = await import("@/server/services/income");
    await recalcIncome({ taxYear: 2025, endMonth: 3 });

    const monthly: Record<number, any> = {};
    for (const call of upserts) {
      const month =
        call.where.userId_monthDate.monthDate.getUTCMonth() + 1;
      monthly[month] = call.update ?? call.create;
    }

    expect(monthly[1].socialInsurance).toBeCloseTo(2103, 2);
    expect(monthly[1].housingFund).toBeCloseTo(2400, 2);
    expect(monthly[1].incomeTax).toBeCloseTo(614.91, 2);
    expect(monthly[1].netIncome).toBeCloseTo(24882.09, 2);

    expect(monthly[2].incomeTax).toBeCloseTo(314.91, 2);
    expect(monthly[2].netIncome).toBeCloseTo(15182.09, 2);

    expect(monthly[3].bonus).toBeCloseTo(30000, 2);
    expect(monthly[3].ltcIncome).toBeCloseTo(10000, 2);
    expect(monthly[3].incomeTax).toBeCloseTo(4699.28, 2);
    expect(monthly[3].netIncome).toBeCloseTo(50797.72, 2);
  });
});
