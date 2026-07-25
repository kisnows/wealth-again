import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FxRate } from "@/server/db/types";
import {
  queueInsertResults,
  queueSelectResults,
  queueUpdateResults,
  resetDbMock,
} from "@/tests/helpers/dbMock";

vi.mock("@/server/services/audit", () => ({
  logAudit: vi.fn(),
  audit: { log: vi.fn(), logAndEmit: vi.fn() },
}));

vi.mock("@/lib/domain/currency", () => ({
  SUPPORTED_CURRENCY_CODES: ["CNY"],
}));

function buildFxRate(overrides: Partial<FxRate> = {}): FxRate {
  const now = new Date();
  return {
    id: overrides.id ?? "fx-rate-test",
    base: overrides.base ?? "USD",
    quote: overrides.quote ?? "CNY",
    rate: overrides.rate ?? "7",
    effectiveFrom: overrides.effectiveFrom ?? now,
    effectiveTo: overrides.effectiveTo ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  } satisfies FxRate;
}

describe("FX update service", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetDbMock();
    const { resetFxUpdateServiceState } = await import(
      "@/server/services/fx/update"
    );
    resetFxUpdateServiceState();
  });

  it("ensureWeeklyFxCoverage enqueues tasks when weeks are missing", async () => {
    // 场景：最近一个月没有任何 USD→CNY 的记录，应自动调度补齐任务
    const { ensureWeeklyFxCoverage } = await import(
      "@/server/services/fx/update"
    );
    queueSelectResults([], []);
    queueInsertResults([
      {
      id: "fx-task-1",
      base: "USD",
      quote: "CNY",
      startDate: new Date("2025-01-01T00:00:00.000Z"),
      endDate: new Date("2025-01-31T00:00:00.000Z"),
      status: "PENDING",
      scheduledFor: new Date(),
      attempts: 0,
      lastError: null,
      triggeredBy: "system",
      processedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      },
    ]);

    const scheduled = await ensureWeeklyFxCoverage({
      lookbackDays: 7,
      asOf: new Date("2025-01-31T00:00:00.000Z"),
    });

    expect(scheduled).toBeGreaterThan(0);
    expect(scheduled).toBe(1);
  });

  it("processDueFxRateUpdateTasks fetches weekly rates and writes snapshots", async () => {
    // 场景：存在待处理的补齐任务，应拉取汇率后按周写入
    const {
      processDueFxRateUpdateTasks,
      setFxRateFetchImplementation,
      resetFxUpdateServiceState,
    } = await import("@/server/services/fx/update");
    const writer = await import("@/server/services/fx/rate-writer");

    const task = {
      id: "task-weekly",
      base: "USD",
      quote: "CNY",
      startDate: new Date("2025-01-06T00:00:00.000Z"),
      endDate: new Date("2025-01-20T00:00:00.000Z"),
      status: "PENDING",
      scheduledFor: new Date(),
      attempts: 0,
      lastError: null,
      triggeredBy: "system",
      processedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    queueSelectResults([task]);
    queueUpdateResults(
      { changes: 1 },
      { changes: 1 },
      { changes: 1 },
      { changes: 1 },
      { changes: 1 },
    );
    queueInsertResults(
      [{ id: "log-1" }],
      [{ id: "log-2" }],
      [{ id: "log-3" }],
    );
    const upsertSpy = vi
      .spyOn(writer, "upsertFxRateWithContinuity")
      .mockResolvedValue(
        buildFxRate({
          id: "fx-rate-1",
          rate: "7.1",
          effectiveFrom: new Date("2025-01-06T00:00:00.000Z"),
        }),
      );

    const mockFetch = vi
      .fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              rates: {
                "2025-01-06": { CNY: 7.1 },
                "2025-01-13": { CNY: 7.15 },
                "2025-01-20": { CNY: 7.18 },
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        ),
      );

    setFxRateFetchImplementation(mockFetch as unknown as typeof fetch);
    const nowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValue(new Date("2025-01-25T00:00:00.000Z").getTime());

    const result = await processDueFxRateUpdateTasks(5);

    expect(result.processed).toBe(1);
    expect(upsertSpy).toHaveBeenCalled();

    upsertSpy.mockRestore();
    setFxRateFetchImplementation(null);
    resetFxUpdateServiceState();
    nowSpy.mockRestore();
  });

  it("processDueFxRateUpdateTasks skips FxRateOverlapError without failing the task", async () => {
    // 场景：写入汇率时发生区间重叠（并发/重复任务），应跳过该周而不是让整个任务失败
    const {
      processDueFxRateUpdateTasks,
      setFxRateFetchImplementation,
      resetFxUpdateServiceState,
    } = await import("@/server/services/fx/update");
    const writer = await import("@/server/services/fx/rate-writer");
    const { FxRateOverlapError } = await import("@/server/services/fx/rate-writer");

    const task = {
      id: "task-overlap",
      base: "USD",
      quote: "CNY",
      startDate: new Date("2025-01-06T00:00:00.000Z"),
      endDate: new Date("2025-01-06T00:00:00.000Z"),
      status: "PENDING",
      scheduledFor: new Date(),
      attempts: 0,
      lastError: null,
      triggeredBy: "system",
      processedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    queueSelectResults([task]);

    vi.spyOn(writer, "upsertFxRateWithContinuity").mockRejectedValueOnce(
      new FxRateOverlapError(),
    );

    const mockFetch = vi
      .fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              rates: {
                "2025-01-06": { CNY: 7.1 },
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        ),
      );
    setFxRateFetchImplementation(mockFetch as unknown as typeof fetch);

    const result = await processDueFxRateUpdateTasks(1);
    expect(result.processed).toBe(1);

    setFxRateFetchImplementation(null);
    resetFxUpdateServiceState();
  });

  it("falls back to exchangerate.host when Frankfurter rejects the currency", async () => {
    // 场景：Frankfurter 不支持 CNY，需要自动降级到 exchangerate.host
    const envBackup = process.env.EXCHANGERATE_HOST_API_KEY;
    process.env.EXCHANGERATE_HOST_API_KEY = "test-key";

    const {
      processDueFxRateUpdateTasks,
      setFxRateFetchImplementation,
      resetFxUpdateServiceState,
    } = await import("@/server/services/fx/update");
    const writer = await import("@/server/services/fx/rate-writer");

    const task = {
      id: "task-fallback",
      base: "USD",
      quote: "CNY",
      startDate: new Date("2025-01-06T00:00:00.000Z"),
      endDate: new Date("2025-01-13T00:00:00.000Z"),
      status: "PENDING",
      scheduledFor: new Date(),
      attempts: 0,
      lastError: null,
      triggeredBy: "system",
      processedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    queueSelectResults([task]);
    queueUpdateResults(
      { changes: 1 },
      { changes: 1 },
      { changes: 1 },
      { changes: 1 },
    );
    queueInsertResults([{ id: "log-1" }], [{ id: "log-2" }]);
    const upsertSpy = vi
      .spyOn(writer, "upsertFxRateWithContinuity")
      .mockResolvedValue(
        buildFxRate({
          id: "fx-rate-fallback",
          rate: "7.05",
          effectiveFrom: new Date("2025-01-06T00:00:00.000Z"),
        }),
      );

    const fetchMock = vi
      .fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockImplementationOnce(() =>
        Promise.resolve(new Response(null, { status: 422 })),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              rates: {
                "2025-01-06": { CNY: 7.05 },
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        ),
      );

    setFxRateFetchImplementation(fetchMock as unknown as typeof fetch);
    const nowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValue(new Date("2025-01-15T00:00:00.000Z").getTime());

    const result = await processDueFxRateUpdateTasks(3);

    expect(result.processed).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain("frankfurter");
    expect(fetchMock.mock.calls[1][0]).toContain("api.exchangerate.host");
    expect(upsertSpy).toHaveBeenCalled();

    upsertSpy.mockRestore();
    setFxRateFetchImplementation(null);
    resetFxUpdateServiceState();
    nowSpy.mockRestore();
    if (envBackup === undefined) {
      delete process.env.EXCHANGERATE_HOST_API_KEY;
    } else {
      process.env.EXCHANGERATE_HOST_API_KEY = envBackup;
    }
  });
});
