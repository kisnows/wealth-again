import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeJsonRequest } from "@/tests/helpers";

// 本文件针对“收入预测/回算”做金额级断言：
// - 工资：每月 10000
// - 奖金：1 月 20000（并入计税）
// - 长期现金：4 月与 7 月各 3000（季度发放）
// - 社保：按工资基数 10.5%（养老8%+医疗2%+失业0.5%） → 10000×0.105=1050
// - 公积金：按工资基数 12% → 10000×0.12=1200
// - 标准扣除：5000/月
// - 税表：3 万6 以内 3%，超过转 10% 减速算扣除 2520（简化）
// 断言（单位：元）：
// - 1月 682.5（当月含 2w 奖金）；2月 82.5；3月 82.5；4月 172.5（含 3k LTC）
// - 5月 135（跨档后当月税 135）；6月 275；7月 575（含 3k LTC）；8月 275

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
  incomeRecord: { upsert: vi.fn() },
  idempotencyKey: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  auditLog: { create: vi.fn() },
};

vi.mock("@/server/db", () => ({ default: mockPrisma }));

beforeEach(() => vi.clearAllMocks());

describe("收入预测与回算（半年 + 5-8 月截取）", () => {
  it("半年（1-6月）与 5-8 月的应纳税额准确", async () => {
    const recalc = await import("@/app/api/v1/income/recalc/route");
    // 用户（CN）
  mockPrisma.user.findMany.mockResolvedValueOnce([
    {
      id: "u1",
      currentCityId: "c1",
      currentCity: { country: "CN" },
    },
  ]);
    // 工资变更：10000/月
    mockPrisma.incomeChange.findFirst.mockResolvedValue({
      grossMonthly: 10000,
    });
    // 奖金：1 月 20000
    mockPrisma.bonusPlan.findMany.mockImplementation(({ where }: any) => {
      const gte = where.effectiveDate.gte as Date;
      const lt = where.effectiveDate.lt as Date;
      const isJan = gte.getUTCMonth() === 0 && lt.getUTCMonth() === 1;
      return Promise.resolve(isJan ? [{ amount: 20000 }] : []);
    });
    // 长期现金：4 月与 7 月各 3000
    mockPrisma.longTermCashPayout.findMany.mockImplementation(
      ({ where }: any) => {
        const g = where.payDate.gte as Date;
        const _l = where.payDate.lt as Date;
        const m = g.getUTCMonth();
        if (m === 3) return Promise.resolve([{ amount: 3000 }]); // 4 月（0-based）
        if (m === 6) return Promise.resolve([{ amount: 3000 }]); // 7 月
        return Promise.resolve([]);
      },
    );
    mockPrisma.equityVest.findMany.mockResolvedValue([]);
    // 社保/公积金规则（基数 clamp=工资本身）
    mockPrisma.cityRuleSS.findFirst.mockResolvedValue({
      baseMin: 0,
      baseMax: 100000,
      ratePension: 0.08,
      rateMedical: 0.02,
      rateUnemployment: 0.005,
    });
    mockPrisma.cityRuleHF.findFirst.mockResolvedValue({
      baseMin: 0,
      baseMax: 100000,
      rateEmployee: 0.12,
    });
    // 税制：标准扣除 5000；税表（简化）
    mockPrisma.taxConfig.findUnique.mockResolvedValue({
      country: "CN",
      taxYear: 2025,
      standardDeduction: 5000,
      brackets: undefined,
    });
    mockPrisma.taxBracket.findMany.mockResolvedValueOnce([
      { position: 1, threshold: 36000, taxRate: 0.03, quickDeduction: 0 },
      { position: 2, threshold: 144000, taxRate: 0.1, quickDeduction: 2520 },
      {
        position: 7,
        threshold: 1000000000,
        taxRate: 0.45,
        quickDeduction: 181920,
      },
    ]);
    mockPrisma.incomeRecord.upsert.mockResolvedValue({});

    // 回算到 8 月，便于截取 5-8 月
    const resp = await recalc.POST(
      makeJsonRequest("http://localhost/api/v1/income/recalc", "POST", {
        taxYear: 2025,
        endMonth: 8,
      }),
    );
    expect(resp.status).toBe(200);

    // 收集 upsert 调用，按 monthDate 映射断言
    const calls = (mockPrisma.incomeRecord.upsert as any).mock.calls as any[];
    const byMonth: Record<number, any> = {};
    for (const c of calls) {
      const arg = c[0];
      const d: Date = arg.where.userId_monthDate.monthDate;
      byMonth[d.getUTCMonth() + 1] = {
        // 1-based 月
        incomeTax: Number(arg.update?.incomeTax ?? arg.create?.incomeTax),
        ss: Number(arg.update?.socialInsurance ?? arg.create?.socialInsurance),
        hf: Number(arg.update?.housingFund ?? arg.create?.housingFund),
      };
    }

    // 月度税（单位：元）
    // 基础：SS=1050，HF=1200，标准扣除=5000；普通月应税=2750
    // 1月含奖金：累计应税=22750 → 累计税=682.5；
    // 2月累计=25500 → 税=765（当月 82.5）；3月累计=28250 → 税=847.5（当月 82.5）；
    // 4月含 LTC：本月应税=5750，累计=34000 → 税=1020（当月 172.5）；
    // 5月跨档：累计=36750 → 税=1155（当月 135）；6月累计=39500 → 税=1430（当月 275）；
    // 7月含 LTC：累计=45250 → 税=2005（当月 575）；8月累计=48000 → 税=2280（当月 275）。
    const expectedTax: Record<number, number> = {
      1: 682.5,
      2: 82.5,
      3: 82.5,
      4: 172.5,
      5: 135,
      6: 275,
      7: 575,
      8: 275,
    };
    // 半年（1-6月）断言
    for (let m = 1; m <= 6; m++) {
      expect(byMonth[m]).toBeTruthy();
      expect(byMonth[m].incomeTax).toBeCloseTo(expectedTax[m]);
      expect(byMonth[m].ss).toBeCloseTo(1050);
      expect(byMonth[m].hf).toBeCloseTo(1200);
    }
    // 截取 5-8 月：检查税额
    for (let m = 5; m <= 8; m++) {
      expect(byMonth[m].incomeTax).toBeCloseTo(expectedTax[m]);
    }
  });
});
