import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeGet, makeJsonRequest } from "@/tests/helpers";
import { prismaMock, resetPrismaMock } from "@/tests/helpers/prismaMock";

const mockPrisma = prismaMock;
// Mock 认证函数，返回测试用户
vi.mock("@/server/utils/auth", () => ({
  getUserFromRequest: vi.fn().mockResolvedValue({ id: "u1" }),
}));
const writeOutboxEventMock = vi.fn().mockResolvedValue({ id: "evt" });
vi.mock("@/server/services/outbox", () => ({
  writeOutboxEvent: writeOutboxEventMock,
  fetchPendingOutboxEvents: vi.fn(),
  markOutboxEventDelivered: vi.fn(),
  markOutboxEventFailed: vi.fn(),
}));
const auditLogMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/server/services/audit", () => ({
  logAudit: auditLogMock,
  audit: {
    log: auditLogMock,
    logAndEmit: auditLogMock,
  },
}));

const mockTimelineService = {
  buildIncomeTimeline: vi.fn(),
};

vi.mock("@/server/services/income-tax/income-timeline", () => mockTimelineService);

function buildPendingTask(overrides: Partial<any> = {}) {
  const now = new Date();
  return {
    id: "task-mock",
    userId: "u1",
    taxYear: overrides.taxYear ?? 2025,
    startMonth: overrides.startMonth ?? 1,
    endMonth: overrides.endMonth ?? 12,
    cityId: overrides.cityId ?? null,
    status: "PENDING",
    attempts: overrides.attempts ?? 0,
    scheduledFor: overrides.scheduledFor ?? new Date(now.getTime() - 1_000),
    processedAt: overrides.processedAt ?? null,
    lastError: overrides.lastError ?? null,
    triggeredBy: overrides.triggeredBy ?? "u1",
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

async function runIncomeWorkerOnce(taskOverrides: Partial<any> = {}) {
  const { processDueIncomeRecalcTasks } = await import("@/server/services/income-tax/income");
  const pendingTask = buildPendingTask(taskOverrides);
  mockPrisma.incomeRecalcTask.findMany.mockResolvedValueOnce([pendingTask]);
  mockPrisma.incomeRecalcTask.updateMany.mockResolvedValueOnce({ count: 1 });
  mockPrisma.incomeRecalcTask.update.mockResolvedValueOnce({
    ...pendingTask,
    status: "COMPLETED",
    processedAt: new Date(),
    updatedAt: new Date(),
  });
  await processDueIncomeRecalcTasks();
}

beforeEach(async () => {
  vi.clearAllMocks();
  resetPrismaMock();
  writeOutboxEventMock.mockReset();
  const { clearTaxContextCache } = await import("@/server/services/income-tax/tax");
  clearTaxContextCache();
  mockPrisma.bonusPlan.findMany.mockResolvedValue([]);
  mockPrisma.longTermCashPayout.findMany.mockResolvedValue([]);
  mockPrisma.equityVest.findMany.mockResolvedValue([]);
  mockPrisma.incomeRecord.findFirst.mockResolvedValue(null);
  mockPrisma.incomeRecord.findMany.mockResolvedValue([]);
  mockPrisma.userAnnualDeduction.findUnique.mockResolvedValue(null);
  mockPrisma.userAnnualDeduction.findMany.mockResolvedValue([]);
  mockPrisma.incomeChange.findFirst.mockResolvedValue(null);
  mockPrisma.cityChangeRecord.findMany.mockResolvedValue([]);
  mockPrisma.cityChangeRecord.findFirst.mockResolvedValue(null);
  mockPrisma.city.findMany.mockResolvedValue([]);
  mockPrisma.incomeRecalcTask.findFirst.mockResolvedValue(null);
  mockPrisma.incomeRecalcTask.findMany.mockResolvedValue([]);
  mockPrisma.incomeRecalcTask.updateMany.mockResolvedValue({ count: 0 });
});

// 本文件覆盖收入域路由：工资/奖金/长期现金/股权、月度快照与回算。
// 每个用例通过 mock Prisma 来控制依赖数据，保证用例可重复、可预测。

describe("Income basic endpoints", () => {
  it("salary-changes GET/POST", async () => {
    // 场景：查询与新增工资变更。期望：GET 返回 200；POST 在提供幂等键时成功 201。
    const sc = await import("@/app/api/v1/income-tax/salary-changes/route");
    mockPrisma.incomeChange.findMany.mockResolvedValueOnce([]);
    expect(
      (
        await sc.GET(
          makeGet("http://localhost/api/v1/income-tax/salary-changes?userId=u1"),
        )
      ).status,
    ).toBe(200);
    mockPrisma.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    mockPrisma.incomeChange.create.mockResolvedValueOnce({ id: "i1" });
    expect(
      (
        await sc.POST(
          makeJsonRequest(
            "http://localhost/api/v1/income-tax/salary-changes",
            "POST",
            { userId: "u1", grossMonthly: 10000, effectiveFrom: "2025-01-01" },
            { "Idempotency-Key": "k1" },
          ),
        )
      ).status,
    ).toBe(201);
  });

  it("salary-changes POST idempotency reuse returns 409", async () => {
    // 场景：重复使用幂等键提交工资变更时，应返回 409 并阻止重复插入。
    const sc = await import("@/app/api/v1/income-tax/salary-changes/route");
    mockPrisma.idempotencyKey.findUnique.mockResolvedValueOnce({ key: "k-sc" });
    const res = await sc.POST(
      makeJsonRequest(
        "http://localhost/api/v1/income-tax/salary-changes",
        "POST",
        { userId: "u1", grossMonthly: 10000, effectiveFrom: "2025-01-01" },
        { "Idempotency-Key": "k-sc" },
      ),
    );
    expect(res.status).toBe(409);
  });

  it("bonus GET/POST", async () => {
    // 场景：查询与新增一次性奖金。期望：GET 200；POST 201。
    const bonus = await import("@/app/api/v1/income-tax/bonus/route");
    mockPrisma.bonusPlan.findMany.mockResolvedValueOnce([]);
    expect(
      (
        await bonus.GET(
          makeGet("http://localhost/api/v1/income-tax/bonus?userId=u1"),
        )
      ).status,
    ).toBe(200);
    mockPrisma.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    mockPrisma.bonusPlan.create.mockResolvedValueOnce({ id: "b1" });
    expect(
      (
        await bonus.POST(
          makeJsonRequest(
            "http://localhost/api/v1/income-tax/bonus",
            "POST",
            { userId: "u1", amount: 20000, effectiveDate: "2025-01-10" },
            { "Idempotency-Key": "k2" },
          ),
        )
      ).status,
    ).toBe(201);
  });

  it("ltc plan GET/POST and generate", async () => {
    // 场景：创建长期现金计划并生成发放日程。期望：创建 201；生成 200。
    const ltc = await import("@/app/api/v1/income-tax/ltc/plans/route");
    mockPrisma.longTermCashPlan.findMany.mockResolvedValueOnce([]);
    expect(
      (
        await ltc.GET(
          makeGet("http://localhost/api/v1/income-tax/ltc/plans?userId=u1"),
        )
      ).status,
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
            "http://localhost/api/v1/income-tax/ltc/plans",
            "POST",
            {
              userId: "u1",
              totalAmount: 12000,
              startDate: "2025-04-01",
              periods: 4,
              recurrence: "QUARTERLY",
            },
            { "Idempotency-Key": "k3" },
          ),
        )
      ).status,
    ).toBe(201);
    const gen = await import(
      "@/app/api/v1/income-tax/ltc/plans/[id]/generate/route"
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
          makeGet("http://localhost/api/v1/income-tax/ltc/plans/p1/generate"),
          { params: { id: "p1" } },
        )
      ).status,
    ).toBe(200);
  });

  it("income timeline GET merges actual and forecast", async () => {
    // 场景：请求时间线接口，应返回合并的历史+预测数据。
    const timelineRoute = await import("@/app/api/v1/income-tax/timeline/route");
    const sample = {
      items: [
        {
          recordId: "rec-jan",
          monthDate: "2025-01-01T00:00:00.000Z",
          month: "2025-01",
          currency: "CNY",
          recordCurrency: "CNY",
          cityId: "hz",
          gross: 20000,
          bonus: 0,
          ltcIncome: 0,
          equityIncome: 0,
          socialInsurance: 2103,
          housingFund: 1200,
          specialDeductions: 6000,
          taxableCurrent: 10700,
          taxableCumulative: 10700,
          taxCumulative: 321,
          taxPaidCumulative: 321,
          incomeTax: 321,
          netIncome: 16376,
          source: "system",
          isForecast: false,
          manualNote: "手动备注",
          sourceCurrency: "CNY",
          fxSnapshotId: "snap-jan",
          fxSnapshotCapturedAt: "2025-01-01T00:00:00.000Z",
          fxAppliedRate: 1,
          displayCurrency: "CNY",
          displayRate: 1,
        },
        {
          recordId: null,
          monthDate: "2025-02-01T00:00:00.000Z",
          month: "2025-02",
          currency: "CNY",
          recordCurrency: "CNY",
          cityId: "hz",
          gross: 20000,
          bonus: 5000,
          ltcIncome: 0,
          equityIncome: 0,
          socialInsurance: 2103,
          housingFund: 1200,
          specialDeductions: 6000,
          taxableCurrent: 16700,
          taxableCumulative: 27400,
          taxCumulative: 1880,
          taxPaidCumulative: 1880,
          incomeTax: 1559,
          netIncome: 20138,
          source: "forecast",
          isForecast: true,
          manualNote: null,
          sourceCurrency: "CNY",
          fxSnapshotId: null,
          fxSnapshotCapturedAt: null,
          fxAppliedRate: 1,
          displayCurrency: "CNY",
          displayRate: 1,
        },
      ],
      summary: {
        currency: "CNY",
        counts: { total: 2, actual: 1, forecast: 1 },
        totals: {
          actual: {
            gross: 20000,
            bonus: 0,
            ltcIncome: 0,
            equityIncome: 0,
            socialInsurance: 2103,
            housingFund: 1200,
            incomeTax: 321,
            netIncome: 16376,
          },
          forecast: {
            gross: 20000,
            bonus: 5000,
            ltcIncome: 0,
            equityIncome: 0,
            socialInsurance: 2103,
            housingFund: 1200,
            incomeTax: 1559,
            netIncome: 20138,
          },
          combined: {
            gross: 40000,
            bonus: 5000,
            ltcIncome: 0,
            equityIncome: 0,
            socialInsurance: 4206,
            housingFund: 2400,
            incomeTax: 1880,
            netIncome: 36514,
          },
        },
      },
      meta: {
        range: {
          from: "2025-01-01T00:00:00.000Z",
          to: "2025-02-01T00:00:00.000Z",
        },
      },
    };
    mockTimelineService.buildIncomeTimeline.mockResolvedValueOnce(sample);
    const res = await timelineRoute.GET(
      makeGet(
        "http://localhost/api/v1/income-tax/timeline?from=2025-01-01&to=2025-02-01",
      ),
    );
    expect(res.status).toBe(200);
    expect(mockTimelineService.buildIncomeTimeline).toHaveBeenCalledWith(
      "u1",
      "2025-01-01",
      "2025-02-01",
      undefined,
    );
    expect(await res.json()).toEqual(sample);
  });

  it("equity grants GET/POST, generate, vest patch", async () => {
    // 场景：创建股权授予、生成归属日程、回填归属市值。期望：均成功。
    const grants = await import("@/app/api/v1/income-tax/equity/grants/route");
    mockPrisma.equityGrant.findMany.mockResolvedValueOnce([]);
    expect(
      (
        await grants.GET(
          makeGet("http://localhost/api/v1/income-tax/equity/grants?userId=u1"),
        )
      ).status,
    ).toBe(200);
    mockPrisma.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    mockPrisma.equityGrant.create.mockResolvedValueOnce({ id: "g1" });
    expect(
      (
        await grants.POST(
          makeJsonRequest(
            "http://localhost/api/v1/income-tax/equity/grants",
            "POST",
            {
              userId: "u1",
              totalUnits: 400,
              startVestDate: "2025-07-01",
              vestPeriods: 4,
              vestInterval: "YEARLY",
            },
            { "Idempotency-Key": "k4" },
          ),
        )
      ).status,
    ).toBe(201);
    const gen = await import(
      "@/app/api/v1/income-tax/equity/grants/[id]/generate/route"
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
          makeGet("http://localhost/api/v1/income-tax/equity/grants/g1/generate"),
          { params: { id: "g1" } },
        )
      ).status,
    ).toBe(200);
    const vest = await import("@/app/api/v1/income-tax/equity/vests/[id]/route");
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
            "http://localhost/api/v1/income-tax/equity/vests/v1",
            "PATCH",
            { fairValue: 123, currency: "CNY" },
          ),
          { params: { id: "v1" } },
        )
      ).status,
    ).toBe(200);
  });

  it("income records GET & PATCH, recalc paths", async () => {
    // 场景A：查询月度快照 + 覆盖基数
    const recs = await import("@/app/api/v1/income-tax/records/route");
    mockPrisma.incomeRecord.findMany.mockResolvedValue([]);
    expect(
      (
        await recs.GET(
          makeGet(
            "http://localhost/api/v1/income-tax/records?userId=u1&from=2025-01-01&to=2025-12-01",
          ),
        )
      ).status,
    ).toBe(200);
    const rec = await import("@/app/api/v1/income-tax/records/[id]/route");
    mockPrisma.incomeRecord.findUnique.mockResolvedValueOnce({
      id: "r1",
      userId: "u1",
    });
    mockPrisma.incomeRecord.update.mockResolvedValueOnce({ id: "r1" });
    expect(
      (
        await rec.PATCH(
          makeJsonRequest(
            "http://localhost/api/v1/income-tax/records/r1",
            "PATCH",
            { socialInsuranceBase: 5000 },
          ),
          { params: { id: "r1" } },
        )
      ).status,
    ).toBe(200);

    // 场景B：回算参数缺失 → 400
    const recalc = await import("@/app/api/v1/income-tax/recalc/route");
    expect(
      (
        await recalc.POST(
          makeJsonRequest("http://localhost/api/v1/income-tax/recalc", "POST", {}),
        )
      ).status,
    ).toBe(400);

    // 场景C：回算成功路径（提供最小规则/税制数据）
  mockPrisma.user.findMany.mockResolvedValueOnce([
      {
        id: "u1",
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
    const taxConfig = {
      country: "CN",
      taxYear: 2025,
      standardDeduction: 5000,
      brackets: undefined,
    };
    mockPrisma.taxConfig.findUnique.mockResolvedValue(taxConfig);
    mockPrisma.taxConfig.findFirst.mockResolvedValue(taxConfig);
    mockPrisma.userAnnualDeduction.findUnique.mockResolvedValue(null);
    // 当 taxConfig.include 未返回 brackets 时，服务会回退到 taxBracket.findMany
    mockPrisma.taxBracket.findMany.mockResolvedValue([
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
    const scheduleResp = await recalc.POST(
      makeJsonRequest("http://localhost/api/v1/income-tax/recalc", "POST", {
        taxYear: 2025,
        endMonth: 2,
      }),
    );
    expect(scheduleResp.status).toBe(202);
    await runIncomeWorkerOnce({ taxYear: 2025, startMonth: 1, endMonth: 2 });
    expect(writeOutboxEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "income.recalc.completed" }),
    );
  });

  it("income recalc idempotency reuse returns 409", async () => {
    // 场景：回算接口重复提交相同幂等键时需返回 409，避免重复计算。
    const recalc = await import("@/app/api/v1/income-tax/recalc/route");
    mockPrisma.idempotencyKey.findUnique.mockResolvedValueOnce({
      key: "k-recalc",
    });
    const res = await recalc.POST(
      makeJsonRequest(
        "http://localhost/api/v1/income-tax/recalc",
        "POST",
        { taxYear: 2025, endMonth: 8 },
        { "Idempotency-Key": "k-recalc" },
      ),
    );
    expect(res.status).toBe(409);
  });

  it("income recalc amount assertions with simplified rules", async () => {
    // 场景：在极简税务配置下验证累计预扣逻辑，确保累计税额差分为当月个税。
    const recalc = await import("@/app/api/v1/income-tax/recalc/route");
    // 用户
    mockPrisma.user.findMany.mockResolvedValueOnce([
      {
        id: "u1",
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
    const simplifiedTaxConfig = {
      country: "CN",
      taxYear: 2025,
      standardDeduction: 0,
      brackets: undefined,
    };
    mockPrisma.taxConfig.findUnique.mockResolvedValue(simplifiedTaxConfig);
    mockPrisma.taxConfig.findFirst.mockResolvedValue(simplifiedTaxConfig);
    // 税表：36000 @3%，+∞ @45%（简化）
    mockPrisma.taxBracket.findMany.mockResolvedValue([
      { position: 1, threshold: 36000, taxRate: 0.03, quickDeduction: 0 },
      {
        position: 7,
        threshold: 1000000000,
        taxRate: 0.45,
        quickDeduction: 181920,
      },
    ]);
    mockPrisma.incomeRecord.upsert.mockResolvedValue({});
    const scheduleResp = await recalc.POST(
      makeJsonRequest("http://localhost/api/v1/income-tax/recalc", "POST", {
        taxYear: 2025,
        endMonth: 2,
      }),
    );
    expect(scheduleResp.status).toBe(202);
    await runIncomeWorkerOnce({ taxYear: 2025, startMonth: 1, endMonth: 2 });
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

  it("annual deductions endpoint returns list", async () => {
    const route = await import("@/app/api/v1/identity/user/annual-deductions/route");
    const now = new Date("2025-01-01");
    mockPrisma.userAnnualDeduction.findMany.mockResolvedValueOnce([
      {
        id: "ded-1",
        userId: "u1",
        taxYear: 2025,
        annualAmount: 12000,
        allocationRule: "AVERAGE",
        note: "子女教育",
        createdAt: now,
        updatedAt: now,
      },
    ]);
    const res = await route.GET(
      makeGet("http://localhost/api/v1/identity/user/annual-deductions"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].annualAmount).toBe(12000);
  });
});
