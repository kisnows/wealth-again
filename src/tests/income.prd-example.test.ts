import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeJsonRequest } from "@/tests/helpers";

// PRD 示例（doc/prd-income.md 1–3 月）：
// - 工资：自 2025-01 起 20000（当月生效）
// - 奖金：2025-03 发放 30000（并入计税）
// - 长期现金：总额 160000，季度 16 期，每期 10000，2025-01/04/07/10…
// - 社保（个人）：养老8%、医保2%+3元、失业0.5%（基数=20000）→ 2103
// - 公积金（个人）：12%（基数=20000）→ 2400
// - 基本减除：5000/月；专项附加：0
// 期望个税：1月 614.91；2月 314.91；3月 4699.28（季度在 1/4/7/10 发放，3 月无 LTC）

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

describe("PRD 示例（2025 年 1–3 月）", () => {
  it("当月个税匹配 PRD 数字", async () => {
    const recalc = await import("@/app/api/v1/income/recalc/route");
    // 用户（CN/HZ）
    mockPrisma.user.findMany.mockResolvedValueOnce([
      {
        id: "u1",
        baseCurrency: "CNY",
        currentCityId: "c1",
        currentCity: { country: "CN" },
      },
    ]);
    // 工资：2025-01 起 20000
    mockPrisma.incomeChange.findFirst.mockResolvedValue({
      grossMonthly: 20000,
    });
    // 奖金：3 月 30000
    mockPrisma.bonusPlan.findMany.mockImplementation(({ where }: any) => {
      const gte = where.effectiveDate.gte as Date;
      const m = gte.getUTCMonth();
      return Promise.resolve(m === 2 ? [{ amount: 30000 }] : []);
    });
    // LTC：1 月 10000，3月也有10000（按PRD示例）
    mockPrisma.longTermCashPayout.findMany.mockImplementation(
      ({ where }: any) => {
        const g = where.payDate.gte as Date;
        const m = g.getUTCMonth();
        return Promise.resolve(m === 0 || m === 2 ? [{ amount: 10000 }] : []);
      },
    );
    mockPrisma.equityVest.findMany.mockResolvedValue([]);
    // 社保/公积金：基数区间包含 20000；比例如 PRD；医保固定额 +3
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
    // 税制：标准 5000、专项 0；税表按 PRD（7 档）
    mockPrisma.taxConfig.findUnique.mockResolvedValue({
      country: "CN",
      taxYear: 2025,
      standardDeduction: 5000,
      specialAdditionalDeduction: 0,
      brackets: undefined,
    });
    mockPrisma.taxBracket.findMany.mockResolvedValueOnce([
      { position: 1, threshold: 36000, taxRate: 0.03, quickDeduction: 0 },
      { position: 2, threshold: 144000, taxRate: 0.1, quickDeduction: 2520 },
      { position: 3, threshold: 300000, taxRate: 0.2, quickDeduction: 16920 },
      { position: 4, threshold: 420000, taxRate: 0.25, quickDeduction: 31920 },
      { position: 5, threshold: 660000, taxRate: 0.3, quickDeduction: 52920 },
      { position: 6, threshold: 960000, taxRate: 0.35, quickDeduction: 85920 },
      {
        position: 7,
        threshold: 1000000000,
        taxRate: 0.45,
        quickDeduction: 181920,
      },
    ]);
    mockPrisma.incomeRecord.upsert.mockResolvedValue({});

    const resp = await recalc.POST(
      makeJsonRequest("http://localhost/api/v1/income/recalc", "POST", {
        taxYear: 2025,
        endMonth: 3,
      }),
    );
    expect(resp.status).toBe(200);

    // 取出 1-3 月 upsert 的税额
    const calls = (mockPrisma.incomeRecord.upsert as any).mock.calls as any[];
    const byMonth: Record<number, any> = {};
    for (const c of calls) {
      const arg = c[0];
      const d: Date = arg.where.userId_monthDate.monthDate;
      const m = d.getUTCMonth() + 1;
      byMonth[m] = {
        tax: Number(arg.update?.incomeTax ?? arg.create?.incomeTax),
        ss: Number(arg.update?.socialInsurance ?? arg.create?.socialInsurance),
        hf: Number(arg.update?.housingFund ?? arg.create?.housingFund),
      };
    }
    expect(byMonth[1].ss).toBeCloseTo(2103, 2);
    expect(byMonth[1].hf).toBeCloseTo(2400, 2);
    expect(byMonth[1].tax).toBeCloseTo(614.91, 2);
    expect(byMonth[2].tax).toBeCloseTo(314.91, 2);
    expect(byMonth[3].tax).toBeCloseTo(4699.28, 2);
  });
});
