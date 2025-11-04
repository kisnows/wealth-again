import { Prisma } from "@prisma/client";
import type { FxRate } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetPrismaMock, prismaMock } from "@/tests/helpers/prismaMock";

vi.mock("@/server/services/audit", () => ({
  logAudit: vi.fn(),
  audit: { log: vi.fn(), logAndEmit: vi.fn() },
}));

function buildFxRate(overrides: Partial<FxRate> = {}): FxRate {
  const now = new Date();
  return {
    id: overrides.id ?? "fx-rate-test",
    base: overrides.base ?? "USD",
    quote: overrides.quote ?? "CNY",
    rate:
      overrides.rate instanceof Prisma.Decimal
        ? overrides.rate
        : new Prisma.Decimal(7),
    effectiveFrom: overrides.effectiveFrom ?? now,
    effectiveTo: overrides.effectiveTo ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  } satisfies FxRate;
}

describe("FX update service", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetPrismaMock();
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
    prismaMock.fxRate.findMany.mockResolvedValue([]);
    prismaMock.fxRateUpdateTask.findFirst.mockResolvedValue(null);
    prismaMock.fxRateUpdateTask.create.mockResolvedValueOnce({
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
    });

    const scheduled = await ensureWeeklyFxCoverage({
      lookbackDays: 30,
      asOf: new Date("2025-01-31T00:00:00.000Z"),
    });

    expect(scheduled).toBeGreaterThan(0);
    expect(prismaMock.fxRateUpdateTask.create).toHaveBeenCalled();
    const [{ data }] = prismaMock.fxRateUpdateTask.create.mock.calls[0];
    expect(data.triggeredBy).toBe("system");
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

    prismaMock.fxRateUpdateTask.findMany.mockResolvedValueOnce([task]);
    prismaMock.fxRateUpdateTask.updateMany.mockResolvedValueOnce({ count: 1 });
    const updateSpy = prismaMock.fxRateUpdateTask.update;
    const upsertSpy = vi
      .spyOn(writer, "upsertFxRateWithContinuity")
      .mockResolvedValue(
        buildFxRate({
          id: "fx-rate-1",
          rate: new Prisma.Decimal(7.1),
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
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "task-weekly" } }),
    );
    expect(prismaMock.fxRateUpdateLog.upsert).toHaveBeenCalled();
    const hasCompleted = prismaMock.fxRateUpdateLog.update.mock.calls.some(
      (call: unknown[]) => {
        const [args] = call as [{ data?: { status?: string } }];
        return args?.data?.status === "COMPLETED";
      },
    );
    expect(hasCompleted).toBe(true);

    upsertSpy.mockRestore();
    setFxRateFetchImplementation(null);
    resetFxUpdateServiceState();
    nowSpy.mockRestore();
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

    prismaMock.fxRateUpdateTask.findMany.mockResolvedValueOnce([task]);
    prismaMock.fxRateUpdateTask.updateMany.mockResolvedValueOnce({ count: 1 });
    const updateSpy = prismaMock.fxRateUpdateTask.update;
    const upsertSpy = vi
      .spyOn(writer, "upsertFxRateWithContinuity")
      .mockResolvedValue(
        buildFxRate({
          id: "fx-rate-fallback",
          rate: new Prisma.Decimal(7.05),
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
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "task-fallback" } }),
    );

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
