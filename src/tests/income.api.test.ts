import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeGet, makeJsonRequest } from "@/tests/helpers";
import {
  insertCalls,
  queueInsertResults,
  resetDbMock,
  setSelectFallback,
} from "@/tests/helpers/dbMock";
import { dbAdapterMock, resetDbAdapterMock } from "@/tests/helpers/dbAdapterMock";
import {
  bonusPlans,
  cityRuleHF,
  cityRuleSS,
  equityVests,
  incomeChanges,
  incomeRecords,
  longTermCashPayouts,
  taxBracket,
  taxConfig,
  userAnnualDeductions,
  users,
} from "@/server/db/schema";

const mockDb = dbAdapterMock;
// Mock 认证函数，返回测试用户
vi.mock("@/server/utils/auth", () => ({
  getUserFromRequest: vi.fn().mockResolvedValue({ id: "u1" }),
}));
const writeOutboxEventMock = vi.fn().mockResolvedValue({ id: "evt" });
const writeOutboxEventSyncMock = vi.fn();
vi.mock("@/server/services/outbox", () => ({
  writeOutboxEvent: writeOutboxEventMock,
  writeOutboxEventSync: writeOutboxEventSyncMock,
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

const scheduleIncomeRecalcTaskMock = vi.fn().mockResolvedValue("task-annual");
vi.mock("@/server/services/income-tax/income", async () => {
  const actual = await vi.importActual<
    typeof import("@/server/services/income-tax/income")
  >("@/server/services/income-tax/income");
  return {
    ...actual,
    scheduleIncomeRecalcTask: scheduleIncomeRecalcTaskMock,
  };
});

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
  mockDb.incomeRecalcTask.findMany.mockResolvedValueOnce([pendingTask]);
  mockDb.incomeRecalcTask.updateMany.mockResolvedValueOnce({ count: 1 });
  mockDb.incomeRecalcTask.update.mockResolvedValueOnce({
    ...pendingTask,
    status: "COMPLETED",
    processedAt: new Date(),
    updatedAt: new Date(),
  });
  await processDueIncomeRecalcTasks();
}

beforeEach(async () => {
  vi.clearAllMocks();
  resetDbAdapterMock();
  writeOutboxEventMock.mockReset();
  writeOutboxEventSyncMock.mockReset();
  scheduleIncomeRecalcTaskMock.mockReset();
  scheduleIncomeRecalcTaskMock.mockResolvedValue("task-annual");
  setSelectFallback(null);
  const { clearTaxContextCache } = await import("@/server/services/income-tax/tax");
  clearTaxContextCache();
});

// 本文件覆盖收入域路由：工资/奖金/长期现金/股权、月度快照与回算。
// 每个用例通过 mock Prisma 来控制依赖数据，保证用例可重复、可预测。

describe("Income basic endpoints", () => {
  it("salary-changes GET/POST", async () => {
    // 场景：查询与新增工资变更。期望：GET 返回 200；POST 在提供幂等键时成功 201。
    const sc = await import("@/app/api/v1/income-tax/salary-changes/route");
    mockDb.incomeChange.findMany.mockResolvedValueOnce([]);
    expect(
      (
        await sc.GET(
          makeGet("http://localhost/api/v1/income-tax/salary-changes?userId=u1"),
        )
      ).status,
    ).toBe(200);
    mockDb.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    mockDb.incomeChange.create.mockResolvedValueOnce({ id: "i1" });
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
    mockDb.idempotencyKey.findUnique.mockResolvedValueOnce({ key: "k-sc" });
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
    mockDb.bonusPlan.findMany.mockResolvedValueOnce([]);
    expect(
      (
        await bonus.GET(
          makeGet("http://localhost/api/v1/income-tax/bonus?userId=u1"),
        )
      ).status,
    ).toBe(200);
    mockDb.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    mockDb.bonusPlan.create.mockResolvedValueOnce({ id: "b1" });
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
    mockDb.longTermCashPlan.findMany.mockResolvedValueOnce([]);
    expect(
      (
        await ltc.GET(
          makeGet("http://localhost/api/v1/income-tax/ltc/plans?userId=u1"),
        )
      ).status,
    ).toBe(200);
    mockDb.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    mockDb.longTermCashPlan.create.mockResolvedValueOnce({
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
    mockDb.longTermCashPlan.findUnique.mockResolvedValueOnce({
      id: "p1",
      userId: "u1",
      totalAmount: 12000,
      currency: "CNY",
      startDate: new Date("2025-04-01"),
      periods: 4,
      recurrence: "QUARTERLY",
    });
    mockDb.longTermCashPayout.upsert.mockResolvedValue({});
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
    mockDb.equityGrant.findMany.mockResolvedValueOnce([]);
    expect(
      (
        await grants.GET(
          makeGet("http://localhost/api/v1/income-tax/equity/grants?userId=u1"),
        )
      ).status,
    ).toBe(200);
    mockDb.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    mockDb.equityGrant.create.mockResolvedValueOnce({ id: "g1" });
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
    mockDb.equityGrant.findUnique.mockResolvedValueOnce({
      id: "g1",
      userId: "u1",
      totalUnits: 400,
      currency: "CNY",
      startVestDate: new Date("2025-07-01"),
      vestPeriods: 4,
      vestInterval: "YEARLY",
    });
    mockDb.equityVest.upsert.mockResolvedValue({});
    expect(
      (
        await gen.POST(
          makeGet("http://localhost/api/v1/income-tax/equity/grants/g1/generate"),
          { params: { id: "g1" } },
        )
      ).status,
    ).toBe(200);
    const vest = await import("@/app/api/v1/income-tax/equity/vests/[id]/route");
    resetDbMock();
    setSelectFallback(({ table }) => {
      if (table === equityVests) {
        return [
          {
            id: "v1",
            vestDate: new Date("2025-07-01"),
            grantUserId: "u1",
          },
        ];
      }
      return [];
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
    mockDb.incomeRecord.findMany.mockResolvedValue([]);
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
    mockDb.incomeRecord.findUnique.mockResolvedValueOnce({
      id: "r1",
      userId: "u1",
    });
    mockDb.incomeRecord.update.mockResolvedValueOnce({ id: "r1" });
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
    setSelectFallback(({ table }) => {
      if (table === users) {
        return [
          {
            id: "u1",
            currentCityId: "c1",
            currentCity: { country: "CN" },
          },
        ];
      }
      if (table === incomeChanges) {
        return [{ grossMonthly: "10000", currency: "CNY" }];
      }
      if (table === bonusPlans) {
        return [];
      }
      if (table === longTermCashPayouts) {
        return [];
      }
      if (table === equityVests) {
        return [];
      }
      if (table === cityRuleSS) {
        return [
          {
            baseMin: "4000",
            baseMax: "20000",
            ratePension: "0.08",
            rateMedical: "0.02",
            rateUnemployment: "0.005",
          },
        ];
      }
      if (table === cityRuleHF) {
        return [
          {
            baseMin: "2000",
            baseMax: "40000",
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
          },
        ];
      }
      if (table === taxBracket) {
        return [
          { position: 1, threshold: "36000", taxRate: "0.03", quickDeduction: "0" },
          { position: 2, threshold: "144000", taxRate: "0.1", quickDeduction: "2520" },
          {
            position: 7,
            threshold: "1000000000",
            taxRate: "0.45",
            quickDeduction: "181920",
          },
        ];
      }
      if (table === userAnnualDeductions) {
        return [];
      }
      if (table === incomeRecords) {
        return [];
      }
      return [];
    });
    const scheduleResp = await recalc.POST(
      makeJsonRequest("http://localhost/api/v1/income-tax/recalc", "POST", {
        taxYear: 2025,
        endMonth: 2,
      }),
    );
    expect(scheduleResp.status).toBe(202);
    queueInsertResults({ id: "r1" }, { id: "r2" });
    await runIncomeWorkerOnce({ taxYear: 2025, startMonth: 1, endMonth: 2 });
    expect(writeOutboxEventSyncMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "income.recalc.completed" }),
    );
  });

  it("income recalc idempotency reuse returns 409", async () => {
    // 场景：回算接口重复提交相同幂等键时需返回 409，避免重复计算。
    const recalc = await import("@/app/api/v1/income-tax/recalc/route");
    mockDb.idempotencyKey.findUnique.mockResolvedValueOnce({
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
    setSelectFallback(({ table }) => {
      if (table === users) {
        return [
          {
            id: "u1",
            currentCityId: "c1",
            currentCity: { country: "CN" },
          },
        ];
      }
      if (table === incomeChanges) {
        return [{ grossMonthly: "10000", currency: "CNY" }];
      }
      if (table === bonusPlans) {
        return [];
      }
      if (table === longTermCashPayouts) {
        return [];
      }
      if (table === equityVests) {
        return [];
      }
      if (table === cityRuleSS) {
        return [];
      }
      if (table === cityRuleHF) {
        return [];
      }
      if (table === taxConfig) {
        return [
          {
            country: "CN",
            taxYear: 2025,
            standardDeduction: "0",
          },
        ];
      }
      if (table === taxBracket) {
        return [
          { position: 1, threshold: "36000", taxRate: "0.03", quickDeduction: "0" },
          {
            position: 7,
            threshold: "1000000000",
            taxRate: "0.45",
            quickDeduction: "181920",
          },
        ];
      }
      if (table === userAnnualDeductions) {
        return [];
      }
      if (table === incomeRecords) {
        return [];
      }
      return [];
    });
    const scheduleResp = await recalc.POST(
      makeJsonRequest("http://localhost/api/v1/income-tax/recalc", "POST", {
        taxYear: 2025,
        endMonth: 2,
      }),
    );
    expect(scheduleResp.status).toBe(202);
    queueInsertResults({ id: "r1" }, { id: "r2" });
    await runIncomeWorkerOnce({ taxYear: 2025, startMonth: 1, endMonth: 2 });
    // 断言前两个月税额：10000*3%=300；第二月累计 20000 → 税额 600，月税=300
    const records = insertCalls
      .filter((call) => call.table === incomeRecords)
      .map((call) => call.values as { monthDate: Date; incomeTax?: string })
      .sort((a, b) => a.monthDate.getTime() - b.monthDate.getTime());
    const [first, second] = records;
    const firstTax = Number(first?.incomeTax ?? 0);
    const secondTax = Number(second?.incomeTax ?? 0);
    expect(firstTax).toBeCloseTo(300);
    expect(secondTax).toBeCloseTo(300);
  });

  it("annual deductions endpoint returns list", async () => {
    const route = await import("@/app/api/v1/identity/user/annual-deductions/route");
    const now = new Date("2025-01-01");
    mockDb.userAnnualDeduction.findMany.mockResolvedValueOnce([
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

  it("annual deductions POST upserts record and schedules recalc", async () => {
    const route = await import("@/app/api/v1/identity/user/annual-deductions/route");
    const now = new Date("2025-02-01T00:00:00Z");
    mockDb.userAnnualDeduction.upsert.mockResolvedValueOnce({
      id: "ded-1",
      userId: "u1",
      taxYear: 2025,
      annualAmount: 12000,
      allocationRule: "AVERAGE",
      note: "子女教育",
      createdAt: now,
      updatedAt: now,
    });

    const res = await route.POST(
      makeJsonRequest(
        "http://localhost/api/v1/identity/user/annual-deductions",
        "POST",
        {
          taxYear: 2025,
          annualAmount: 12000,
          allocationRule: "AVERAGE",
          note: "子女教育",
        },
        { "Idempotency-Key": "ded-post" },
      ),
    );

    expect(res.status).toBe(201);
    expect(scheduleIncomeRecalcTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        taxYear: 2025,
      }),
    );
    expect(auditLogMock).toHaveBeenCalledWith(
      "SETTINGS_ANNUAL_DEDUCTION_UPSERT",
      expect.objectContaining({
        userId: "u1",
      }),
    );
    const payload = await res.json();
    expect(payload.annualAmount).toBe(12000);
    expect(payload.note).toBe("子女教育");
  });

  it("annual deductions PATCH updates record and triggers recalc for both years", async () => {
    const route = await import(
      "@/app/api/v1/identity/user/annual-deductions/[id]/route"
    );
    const createdAt = new Date("2024-01-01T00:00:00Z");
    mockDb.userAnnualDeduction.findUnique.mockResolvedValueOnce({
      id: "ded-2",
      userId: "u1",
      taxYear: 2024,
      annualAmount: 6000,
      allocationRule: "AVERAGE",
      note: null,
      createdAt,
      updatedAt: createdAt,
    });
    mockDb.userAnnualDeduction.update.mockResolvedValueOnce({
      id: "ded-2",
      userId: "u1",
      taxYear: 2025,
      annualAmount: 12000,
      allocationRule: "ONCE",
      note: "租房扣除",
      createdAt,
      updatedAt: new Date("2025-03-01T00:00:00Z"),
    });

    const res = await route.PATCH(
      makeJsonRequest(
        "http://localhost/api/v1/identity/user/annual-deductions/ded-2",
        "PATCH",
        {
          taxYear: 2025,
          annualAmount: 12000,
          allocationRule: "ONCE",
          note: " 租房扣除 ",
        },
        { "Idempotency-Key": "ded-patch" },
      ),
      { params: { id: "ded-2" } },
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.taxYear).toBe(2025);
    expect(payload.allocationRule).toBe("ONCE");
    expect(payload.note).toBe("租房扣除");
    expect(scheduleIncomeRecalcTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({ taxYear: 2024 }),
    );
    expect(scheduleIncomeRecalcTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({ taxYear: 2025 }),
    );
    expect(auditLogMock).toHaveBeenCalledWith(
      "SETTINGS_ANNUAL_DEDUCTION_UPDATE",
      expect.objectContaining({
        userId: "u1",
        meta: expect.objectContaining({
          before: expect.objectContaining({ taxYear: 2024 }),
          after: expect.objectContaining({ taxYear: 2025 }),
        }),
      }),
    );
  });
});
