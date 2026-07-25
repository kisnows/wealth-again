import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeGet, makeJsonRequest } from "@/tests/helpers";
import {
  queueSelectResults,
  resetDbMock,
} from "@/tests/helpers/dbMock";
import { upsertFxRateWithContinuity } from "@/server/services/fx/rate-writer";
import { refreshLatestFxRate } from "@/server/services/fx/update";
import { fxProvider } from "@/server/services/fx/provider";

vi.mock("@/server/services/audit", () => ({
  audit: {
    log: vi.fn(),
    logAndEmit: vi.fn(),
  },
  logAudit: vi.fn(),
}));

vi.mock("@/server/utils/idempotency", () => ({
  ensureIdempotent: vi.fn().mockResolvedValue({ key: "k", existed: false }),
  markIdempotencyUsed: vi.fn(),
}));

vi.mock("@/server/services/fx/rate-writer", () => ({
  upsertFxRateWithContinuity: vi.fn(),
}));

vi.mock("@/server/services/fx/update", async (importOriginal) => ({
  ...(await importOriginal()),
  refreshLatestFxRate: vi.fn(),
}));

beforeEach(async () => {
  vi.clearAllMocks();
  resetDbMock();
  const { clearFxCache } = await import("@/server/services/fx/provider");
  clearFxCache();
});

describe("FX routes", () => {
  it("GET /fxrates returns nearest asOf match", async () => {
    // 用例：查询指定日期的汇率快照时，接口应返回最近的匹配记录。
    const m = await import("@/app/api/v1/fx/rates/route");
    queueSelectResults([
      {
      id: "r1",
      base: "USD",
      quote: "CNY",
      rate: 7.2,
      effectiveFrom: new Date("2025-07-15"),
      effectiveTo: null,
      createdAt: new Date("2025-07-15"),
      },
    ]);
    const res = await m.GET(
      makeGet(
        "http://localhost/api/v1/fx/rates?base=USD&quote=CNY&on=2025-08-01",
      ),
    );
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.rate).toBe(7.2);
  });

  it("GET /fxrates missing quote -> 400", async () => {
    // 用例：缺少 quote 参数时需返回 400，提示请求不完整。
    const m = await import("@/app/api/v1/fx/rates/route");
    const res = await m.GET(
      makeGet("http://localhost/api/v1/fx/rates?base=USD"),
    );
    expect(res.status).toBe(400);
  });

  it("GET /fxrates without on returns latest snapshot", async () => {
    // 用例：未提供 on 参数时，接口应回落到最新快照。
    const m = await import("@/app/api/v1/fx/rates/route");
    queueSelectResults([
      {
      id: "r-latest",
      base: "USD",
      quote: "EUR",
      rate: 0.9,
      effectiveFrom: new Date("2025-08-01"),
      effectiveTo: null,
      createdAt: new Date("2025-08-01"),
      },
    ]);
    const res = await m.GET(
      makeGet("http://localhost/api/v1/fx/rates?base=USD&quote=EUR"),
    );
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.id).toBe("r-latest");
  });

  it("POST /fxrates invalid body -> 400", async () => {
    // 用例：POST 请求缺省必填字段时返回 400，阻止写入。
    const m = await import("@/app/api/v1/fx/rates/route");
    const res = await m.POST(
      makeJsonRequest("http://localhost/api/v1/fx/rates", "POST", {
        base: "USD",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("POST /fxrates creates snapshot", async () => {
    // 用例：POST 提交完整参数时成功创建汇率快照并返回 201。
    const m = await import("@/app/api/v1/fx/rates/route");
    const created = {
      id: "r2",
      base: "USD",
      quote: "CNY",
      rate: "7.1",
      effectiveFrom: new Date("2025-08-02"),
      effectiveTo: null,
      createdAt: new Date("2025-08-02"),
    };
    vi.mocked(upsertFxRateWithContinuity).mockResolvedValueOnce(created as any);
    const res = await m.POST(
      makeJsonRequest("http://localhost/api/v1/fx/rates", "POST", {
        base: "USD",
        quote: "CNY",
        rate: 7.1,
        effectiveFrom: "2025-08-02",
      }),
    );
    expect(res.status).toBe(201);
    expect(upsertFxRateWithContinuity).toHaveBeenCalled();
  });

  it("POST /fxrates splits overlapping intervals以保持连续性", async () => {
    const m = await import("@/app/api/v1/fx/rates/route");
    const created = {
      id: "fx-new",
      base: "USD",
      quote: "CNY",
      rate: "7.13",
      effectiveFrom: new Date("2025-09-01T00:00:00.000Z"),
      effectiveTo: new Date("2025-09-30T00:00:00.000Z"),
      createdAt: new Date("2025-09-01T00:00:00.000Z"),
    };
    vi.mocked(upsertFxRateWithContinuity).mockResolvedValueOnce(created as any);

    const res = await m.POST(
      makeJsonRequest("http://localhost/api/v1/fx/rates", "POST", {
        base: "USD",
        quote: "CNY",
        rate: 7.13,
        effectiveFrom: "2025-09-01T00:00:00.000Z",
        effectiveTo: "2025-09-30T00:00:00.000Z",
      }),
    );

    expect(res.status).toBe(201);
    expect(upsertFxRateWithContinuity).toHaveBeenCalled();
  });

  it("GET /fxrates/latest aggregates latest snapshot per currency", async () => {
    // 用例：批量查询时需返回每个币种最新的 USD 中间价，缺失的币种以 null 标记。
    const m = await import("@/app/api/v1/fx/rates/latest/route");
    queueSelectResults([
      {
        base: "USD",
        quote: "CNY",
        rate: "7.1",
        effectiveFrom: new Date("2025-08-01"),
        effectiveTo: null,
      },
      {
        base: "USD",
        quote: "CNY",
        rate: "7.05",
        effectiveFrom: new Date("2025-07-01"),
        effectiveTo: new Date("2025-08-01"),
      },
    ]);
    const res = await m.GET(
      makeGet("http://localhost/api/v1/fx/rates/latest?quotes=CNY,HKD"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([
      {
        quote: "CNY",
        rate: 7.1,
        effectiveFrom: "2025-08-01T00:00:00.000Z",
        effectiveTo: null,
      },
      {
        quote: "HKD",
        rate: null,
        effectiveFrom: null,
        effectiveTo: null,
      },
    ]);
  });

  it("GET /fx/rates/history returns ordered timeline", async () => {
    const m = await import("@/app/api/v1/fx/rates/history/route");
    queueSelectResults([
      {
        id: "h1",
        base: "USD",
        quote: "CNY",
        rate: "7",
        effectiveFrom: new Date("2025-01-01T00:00:00.000Z"),
        effectiveTo: new Date("2025-07-01T00:00:00.000Z"),
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
      },
      {
        id: "h2",
        base: "USD",
        quote: "CNY",
        rate: "7.2",
        effectiveFrom: new Date("2025-07-01T00:00:00.000Z"),
        effectiveTo: null,
        createdAt: new Date("2025-07-01T00:00:00.000Z"),
      },
    ]);
    const res = await m.GET(
      makeGet("http://localhost/api/v1/fx/rates/history?quote=CNY"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.items[0].rate).toBe(7);
  });

  it("GET /fx/rates/tasks returns paginated tasks", async () => {
    const m = await import("@/app/api/v1/fx/rates/tasks/route");
    queueSelectResults([
      {
        id: "task-1",
        base: "USD",
        quote: "AUD",
        startDate: new Date("2025-01-01T00:00:00.000Z"),
        endDate: new Date("2025-01-31T00:00:00.000Z"),
        status: "PENDING",
        scheduledFor: new Date("2025-01-05T00:00:00.000Z"),
        processedAt: null,
        attempts: 0,
        lastError: null,
        triggeredBy: "system",
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
        updatedAt: new Date("2025-01-02T00:00:00.000Z"),
      },
    ]);
    const res = await m.GET(
      makeGet("http://localhost/api/v1/fx/rates/tasks?limit=20"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].quote).toBe("AUD");
  });

  it("GET /fx/rates/tasks/:id returns detail with logs", async () => {
    const m = await import("@/app/api/v1/fx/rates/tasks/[id]/route");
    queueSelectResults(
      [
        {
      id: "task-1",
      base: "USD",
      quote: "AUD",
      startDate: new Date("2025-01-01T00:00:00.000Z"),
      endDate: new Date("2025-01-31T00:00:00.000Z"),
      status: "RUNNING",
      scheduledFor: new Date("2025-01-05T00:00:00.000Z"),
      processedAt: null,
      attempts: 1,
      lastError: null,
      triggeredBy: "system",
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      updatedAt: new Date("2025-01-02T00:00:00.000Z"),
        },
      ],
      [
        {
          id: "log-1",
          taskId: "task-1",
          weekStart: new Date("2025-01-01T00:00:00.000Z"),
          weekEnd: new Date("2025-01-07T00:00:00.000Z"),
          status: "COMPLETED",
          rate: 7.1,
          attempts: 1,
          lastError: null,
          startedAt: new Date("2025-01-01T01:00:00.000Z"),
          completedAt: new Date("2025-01-01T02:00:00.000Z"),
          createdAt: new Date("2025-01-01T00:00:00.000Z"),
          updatedAt: new Date("2025-01-01T02:00:00.000Z"),
        },
      ],
    );
    const res = await m.GET(
      makeGet("http://localhost/api/v1/fx/rates/tasks/task-1"),
      { params: { id: "task-1" } },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("task-1");
    expect(body.logs).toHaveLength(1);
    expect(body.summary.completed).toBe(1);
  });

  it("POST /fx/rates/refresh 插入最新汇率", async () => {
    const {
      setFxRateFetchImplementation,
      resetFxUpdateServiceState,
    } = await import("@/server/services/fx/update");
    setFxRateFetchImplementation(async () => ({
      ok: true,
      json: async () => ({ rates: { AUD: 1.5 }, date: "2025-01-10" }),
    }) as unknown as typeof fetch);
    const created = {
      id: "fx-new",
      base: "USD",
      quote: "AUD",
      rate: "1.5",
      effectiveFrom: new Date("2025-01-10T00:00:00.000Z"),
      effectiveTo: null,
      createdAt: new Date("2025-01-10T00:00:00.000Z"),
      updatedAt: new Date("2025-01-10T00:00:00.000Z"),
    };
    vi.mocked(refreshLatestFxRate).mockResolvedValueOnce(created as any);
    const m = await import("@/app/api/v1/fx/rates/refresh/route");
    const res = await m.POST(
      makeJsonRequest("http://localhost/api/v1/fx/rates/refresh", "POST", {
        quote: "AUD",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quote).toBe("AUD");
    expect(refreshLatestFxRate).toHaveBeenCalled();
    resetFxUpdateServiceState();
  });
});

describe("FX service", () => {
  it("convert uses USD pivot for CNY→EUR", async () => {
    // 用例：服务层应通过 USD 中间价转换，将 CNY 金额折算为 EUR。
    const { convert } = await import("@/server/services/fx/provider");
    const asOf = new Date("2025-08-01");
    const ensureSpy = vi
      .spyOn(fxProvider, "ensureSnapshot")
      .mockResolvedValueOnce({
        id: "snap-cny",
        baseCurrency: "USD",
        quoteCurrency: "CNY",
        rate: 7,
        capturedAt: asOf,
        sourceRateId: "rate-cny",
        effectiveFrom: asOf,
        effectiveTo: null,
      })
      .mockResolvedValueOnce({
        id: "snap-eur",
        baseCurrency: "USD",
        quoteCurrency: "EUR",
        rate: 0.9,
        capturedAt: asOf,
        sourceRateId: "rate-eur",
        effectiveFrom: asOf,
        effectiveTo: null,
      });
    const out = await convert(7, "CNY", "EUR", asOf);
    expect(out.amount).toBeCloseTo(0.9, 6);
    expect(out.effectiveRate).toBeCloseTo(0.128571, 6);
    expect(out.rateAtoUsd).toBeCloseTo(1 / 7, 6);
    expect(out.rateUsdToB).toBeCloseTo(0.9, 6);
    expect(out.snapshots).toHaveLength(2);
    ensureSpy.mockRestore();
  });

  it("getLatestRates returns latest record per quote and fills missing", async () => {
    // 用例：服务层批量查询需取每个币种的最新快照，并保留缺失项。
    const { getLatestRates } = await import("@/server/services/fx/provider");
    queueSelectResults([
      {
        base: "USD",
        quote: "CNY",
        rate: "7.2",
        effectiveFrom: new Date("2025-08-01"),
        effectiveTo: null,
      },
      {
        base: "USD",
        quote: "EUR",
        rate: "0.9",
        effectiveFrom: new Date("2025-08-01"),
        effectiveTo: null,
      },
      {
        base: "USD",
        quote: "CNY",
        rate: "7.1",
        effectiveFrom: new Date("2025-07-01"),
        effectiveTo: new Date("2025-08-01"),
      },
    ]);
    const results = await getLatestRates("USD", ["CNY", "HKD", "EUR"]);
    expect(results).toEqual([
      {
        quote: "CNY",
        rate: 7.2,
        effectiveFrom: new Date("2025-08-01"),
        effectiveTo: null,
      },
      { quote: "HKD", rate: null, effectiveFrom: null, effectiveTo: null },
      {
        quote: "EUR",
        rate: 0.9,
        effectiveFrom: new Date("2025-08-01"),
        effectiveTo: null,
      },
    ]);
  });

  it("getQuote caches result within TTL", async () => {
    const { getQuote } = await import("@/server/services/fx/provider");
    queueSelectResults([
      {
      id: "rate-cny",
      base: "USD",
      quote: "CNY",
      rate: "7",
      effectiveFrom: new Date("2025-08-01"),
      effectiveTo: null,
      },
    ]);
    const first = await getQuote({ base: "USD", quote: "CNY" });
    expect(first?.rate).toBe(7);
    const second = await getQuote({ base: "USD", quote: "CNY" });
    expect(second?.rate).toBe(7);
  });

  it("getTimeSeries returns ordered points", async () => {
    const { getTimeSeries } = await import("@/server/services/fx/provider");
    const from = new Date("2025-01-01T00:00:00Z");
    const to = new Date("2025-03-01T00:00:00Z");
    queueSelectResults([
      {
        id: "r1",
        base: "USD",
        quote: "CNY",
        rate: "7",
        effectiveFrom: new Date("2025-01-01T00:00:00Z"),
        effectiveTo: new Date("2025-02-01T00:00:00Z"),
      },
      {
        id: "r2",
        base: "USD",
        quote: "CNY",
        rate: "6.9",
        effectiveFrom: new Date("2025-02-01T00:00:00Z"),
        effectiveTo: null,
      },
    ]);
    const series = await getTimeSeries({ base: "USD", quote: "CNY", from, to });
    expect(series).toHaveLength(2);
    expect(series[0].rate).toBe(7);
    expect(series[1].effectiveFrom.toISOString()).toBe(
      "2025-02-01T00:00:00.000Z",
    );
  });
});
