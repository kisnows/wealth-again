import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeGet, makeJsonRequest } from "@/tests/helpers";

const mockPrisma: any = {
  incomeChange: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
  bonusPlan: { findMany: vi.fn(), create: vi.fn() },
  longTermCashPlan: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
  longTermCashPayout: { upsert: vi.fn(), findMany: vi.fn() },
  equityGrant: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
  equityVest: {
    upsert: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  incomeRecord: {
    findMany: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    findUnique: vi.fn(),
  },
  user: { findMany: vi.fn() },
  cityRuleSS: { findFirst: vi.fn() },
  cityRuleHF: { findFirst: vi.fn() },
  taxConfig: { findUnique: vi.fn() },
  taxBracket: { findMany: vi.fn() },
  idempotencyKey: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  auditLog: { create: vi.fn() },
};

vi.mock("@/server/db", () => ({ default: mockPrisma }));
// Mock 认证函数，返回测试用户
vi.mock("@/server/utils/auth", () => ({
  getUserFromRequest: vi.fn().mockResolvedValue({ id: "u1" }),
}));

beforeEach(() => vi.clearAllMocks());

// 本文件覆盖收入域路由：工资/奖金/长期现金/股权、月度快照与回算。
// 每个用例通过 mock Prisma 来控制依赖数据，保证用例可重复、可预测。

describe("Income basic endpoints", () => {
  it("salary-changes GET/POST", async () => {
    // 场景：查询与新增工资变更。期望：GET 返回 200；POST 在提供幂等键时成功 201。
    const sc = await import("@/app/api/v1/income/salary-changes/route");
    mockPrisma.incomeChange.findMany.mockResolvedValueOnce([]);
    expect(
      (
        await sc.GET(
          makeGet("http://localhost/api/v1/income/salary-changes?userId=u1")
        )
      ).status
    ).toBe(200);
    mockPrisma.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    mockPrisma.incomeChange.create.mockResolvedValueOnce({ id: "i1" });
    expect(
      (
        await sc.POST(
          makeJsonRequest(
            "http://localhost/api/v1/income/salary-changes",
            "POST",
            { userId: "u1", grossMonthly: 10000, effectiveFrom: "2025-01-01" },
            { "Idempotency-Key": "k1" }
          )
        )
      ).status
    ).toBe(201);
  });

  it("salary-changes POST idempotency reuse returns 409", async () => {
    const sc = await import("@/app/api/v1/income/salary-changes/route");
    // 重复幂等键
    mockPrisma.idempotencyKey.findUnique.mockResolvedValueOnce({ key: "k-sc" });
    const res = await sc.POST(
      makeJsonRequest(
        "http://localhost/api/v1/income/salary-changes",
        "POST",
        { userId: "u1", grossMonthly: 10000, effectiveFrom: "2025-01-01" },
        { "Idempotency-Key": "k-sc" }
      )
    );
    expect(res.status).toBe(409);
  });

  it("bonus GET/POST", async () => {
    // 场景：查询与新增一次性奖金。期望：GET 200；POST 201。
    const bonus = await import("@/app/api/v1/income/bonus/route");
    mockPrisma.bonusPlan.findMany.mockResolvedValueOnce([]);
    expect(
      (
        await bonus.GET(
          makeGet("http://localhost/api/v1/income/bonus?userId=u1")
        )
      ).status
    ).toBe(200);
    mockPrisma.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    mockPrisma.bonusPlan.create.mockResolvedValueOnce({ id: "b1" });
    expect(
      (
        await bonus.POST(
          makeJsonRequest(
            "http://localhost/api/v1/income/bonus",
            "POST",
            { userId: "u1", amount: 20000, effectiveDate: "2025-01-10" },
            { "Idempotency-Key": "k2" }
          )
        )
      ).status
    ).toBe(201);
  });

  it("ltc plan GET/POST and generate", async () => {
    // 场景：创建长期现金计划并生成发放日程。期望：创建 201；生成 200。
    const ltc = await import("@/app/api/v1/income/ltc/plans/route");
    mockPrisma.longTermCashPlan.findMany.mockResolvedValueOnce([]);
    expect(
      (
        await ltc.GET(
          makeGet("http://localhost/api/v1/income/ltc/plans?userId=u1")
        )
      ).status
    ).toBe(200);
    mockPrisma.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    mockPrisma.longTermCashPlan.create.mockResolvedValueOnce({
      id: "p1",
      userId: "u1",
      totalAmount: 12000,
      currency: "CNY",
      startDate: new Date("2025-04-01"),
      periods: 4,
      recurrence: "QUARTERLY",
    });
    expect(
      (
        await ltc.POST(
          makeJsonRequest(
            "http://localhost/api/v1/income/ltc/plans",
            "POST",
            {
              userId: "u1",
              totalAmount: 12000,
              startDate: "2025-04-01",
              periods: 4,
              recurrence: "QUARTERLY",
            },
            { "Idempotency-Key": "k3" }
          )
        )
      ).status
    ).toBe(201);
    const gen = await import(
      "@/app/api/v1/income/ltc/plans/[id]/generate/route"
    );
    mockPrisma.longTermCashPlan.findUnique.mockResolvedValueOnce({
      id: "p1",
      userId: "u1",
      totalAmount: 12000,
      currency: "CNY",
      startDate: new Date("2025-04-01"),
      periods: 4,
      recurrence: "QUARTERLY",
    });
    mockPrisma.longTermCashPayout.upsert.mockResolvedValue({});
    expect(
      (
        await gen.POST(
          makeGet("http://localhost/api/v1/income/ltc/plans/p1/generate"),
          { params: { id: "p1" } }
        )
      ).status
    ).toBe(200);
  });

  it("equity grants GET/POST, generate, vest patch", async () => {
    // 场景：创建股权授予、生成归属日程、回填归属市值。期望：均成功。
    const grants = await import("@/app/api/v1/income/equity/grants/route");
    mockPrisma.equityGrant.findMany.mockResolvedValueOnce([]);
    expect(
      (
        await grants.GET(
          makeGet("http://localhost/api/v1/income/equity/grants?userId=u1")
        )
      ).status
    ).toBe(200);
    mockPrisma.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    mockPrisma.equityGrant.create.mockResolvedValueOnce({ id: "g1" });
    expect(
      (
        await grants.POST(
          makeJsonRequest(
            "http://localhost/api/v1/income/equity/grants",
            "POST",
            {
              userId: "u1",
              totalUnits: 400,
              startVestDate: "2025-07-01",
              vestPeriods: 4,
              vestInterval: "YEARLY",
            },
            { "Idempotency-Key": "k4" }
          )
        )
      ).status
    ).toBe(201);
    const gen = await import(
      "@/app/api/v1/income/equity/grants/[id]/generate/route"
    );
    mockPrisma.equityGrant.findUnique.mockResolvedValueOnce({
      id: "g1",
      userId: "u1",
      totalUnits: 400,
      currency: "CNY",
      startVestDate: new Date("2025-07-01"),
      vestPeriods: 4,
      vestInterval: "YEARLY",
    });
    mockPrisma.equityVest.upsert.mockResolvedValue({});
    expect(
      (
        await gen.POST(
          makeGet("http://localhost/api/v1/income/equity/grants/g1/generate"),
          { params: { id: "g1" } }
        )
      ).status
    ).toBe(200);
    const vest = await import("@/app/api/v1/income/equity/vests/[id]/route");
    mockPrisma.equityVest.findUnique.mockResolvedValueOnce({
      id: "v1",
      grant: { id: "g1", userId: "u1" },
    });
    mockPrisma.equityVest.update.mockResolvedValueOnce({
      id: "v1",
      fairValue: 123,
    });
    expect(
      (
        await vest.PATCH(
          makeJsonRequest(
            "http://localhost/api/v1/income/equity/vests/v1",
            "PATCH",
            { fairValue: 123, currency: "CNY" }
          ),
          { params: { id: "v1" } }
        )
      ).status
    ).toBe(200);
  });

  it("income records GET & PATCH, recalc paths", async () => {
    // 场景A：查询月度快照 + 覆盖基数
    const recs = await import("@/app/api/v1/income/records/route");
    mockPrisma.incomeRecord.findMany.mockResolvedValueOnce([]);
    expect(
      (
        await recs.GET(
          makeGet(
            "http://localhost/api/v1/income/records?userId=u1&from=2025-01-01&to=2025-12-01"
          )
        )
      ).status
    ).toBe(200);
    const rec = await import("@/app/api/v1/income/records/[id]/route");
    mockPrisma.incomeRecord.findUnique.mockResolvedValueOnce({
      id: "r1",
      userId: "u1",
    });
    mockPrisma.incomeRecord.update.mockResolvedValueOnce({ id: "r1" });
    expect(
      (
        await rec.PATCH(
          makeJsonRequest(
            "http://localhost/api/v1/income/records/r1",
            "PATCH",
            { socialInsuranceBase: 5000 }
          ),
          { params: { id: "r1" } }
        )
      ).status
    ).toBe(200);

    // 场景B：回算参数缺失 → 400
    const recalc = await import("@/app/api/v1/income/recalc/route");
    expect(
      (
        await recalc.POST(
          makeJsonRequest("http://localhost/api/v1/income/recalc", "POST", {})
        )
      ).status
    ).toBe(400);

    // 场景C：回算成功路径（提供最小规则/税制数据）
    mockPrisma.user.findMany.mockResolvedValueOnce([
      {
        id: "u1",
        baseCurrency: "CNY",
        currentCityId: "c1",
        currentCity: { country: "CN" },
      },
    ]);
    mockPrisma.incomeChange.findFirst.mockResolvedValue({
      grossMonthly: 10000,
    });
    mockPrisma.bonusPlan.findMany.mockResolvedValue([]);
    mockPrisma.longTermCashPayout.findMany.mockResolvedValue([]);
    mockPrisma.equityVest.findMany.mockResolvedValue([]);
    mockPrisma.cityRuleSS.findFirst.mockResolvedValue({
      baseMin: 4000,
      baseMax: 20000,
      ratePension: 0.08,
      rateMedical: 0.02,
      rateUnemployment: 0.005,
    });
    mockPrisma.cityRuleHF.findFirst.mockResolvedValue({
      baseMin: 2000,
      baseMax: 40000,
      rateEmployee: 0.12,
    });
    mockPrisma.taxConfig.findUnique.mockResolvedValue({
      country: "CN",
      taxYear: 2025,
      standardDeduction: 5000,
      brackets: undefined,
    });
    // 当 taxConfig.include 未返回 brackets 时，服务会回退到 taxBracket.findMany
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
    expect(
      (
        await recalc.POST(
          makeJsonRequest("http://localhost/api/v1/income/recalc", "POST", {
            taxYear: 2025,
            endMonth: 2,
          })
        )
      ).status
    ).toBe(200);
  });

  it("income recalc idempotency reuse returns 409", async () => {
    const recalc = await import("@/app/api/v1/income/recalc/route");
    // idempotency key 已存在
    mockPrisma.idempotencyKey.findUnique.mockResolvedValueOnce({
      key: "k-recalc",
    });
    const res = await recalc.POST(
      makeJsonRequest(
        "http://localhost/api/v1/income/recalc",
        "POST",
        { taxYear: 2025, endMonth: 8 },
        { "Idempotency-Key": "k-recalc" }
      )
    );
    expect(res.status).toBe(409);
  });

  it("income recalc amount assertions with simplified rules", async () => {
    const recalc = await import("@/app/api/v1/income/recalc/route");
    // 用户
    mockPrisma.user.findMany.mockResolvedValueOnce([
      {
        id: "u1",
        baseCurrency: "CNY",
        currentCityId: "c1",
        currentCity: { country: "CN" },
      },
    ]);
    // 工资：每月税前 10000；SS/HF/standard 均为 0，便于直观计算
    mockPrisma.incomeChange.findFirst.mockResolvedValue({
      grossMonthly: 10000,
    });
    mockPrisma.bonusPlan.findMany.mockResolvedValue([]);
    mockPrisma.longTermCashPayout.findMany.mockResolvedValue([]);
    mockPrisma.equityVest.findMany.mockResolvedValue([]);
    mockPrisma.cityRuleSS.findFirst.mockResolvedValue(null);
    mockPrisma.cityRuleHF.findFirst.mockResolvedValue(null);
    mockPrisma.taxConfig.findUnique.mockResolvedValue({
      country: "CN",
      taxYear: 2025,
      standardDeduction: 0,
      brackets: undefined,
    });
    // 税表：36000 @3%，+∞ @45%（简化）
    mockPrisma.taxBracket.findMany.mockResolvedValueOnce([
      { position: 1, threshold: 36000, taxRate: 0.03, quickDeduction: 0 },
      {
        position: 7,
        threshold: 1000000000,
        taxRate: 0.45,
        quickDeduction: 181920,
      },
    ]);
    mockPrisma.incomeRecord.upsert.mockResolvedValue({});
    const res = await recalc.POST(
      makeJsonRequest("http://localhost/api/v1/income/recalc", "POST", {
        taxYear: 2025,
        endMonth: 2,
      })
    );
    expect(res.status).toBe(200);
    // 断言前两个月税额：10000*3%=300；第二月累计 20000 → 税额 600，月税=300
    const calls = (mockPrisma.incomeRecord.upsert as any).mock.calls as any[];
    // 找两次调用的 create 或 update 值
    const [firstArg, secondArg] = [calls[0][0], calls[1][0]];
    const firstTax = (firstArg.update?.incomeTax ??
      firstArg.create?.incomeTax) as number;
    const secondTax = (secondArg.update?.incomeTax ??
      secondArg.create?.incomeTax) as number;
    expect(firstTax).toBeCloseTo(300);
    expect(secondTax).toBeCloseTo(300);
  });
});
