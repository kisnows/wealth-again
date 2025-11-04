import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetPrismaMock, prismaMock } from "@/tests/helpers/prismaMock";

vi.mock("@/server/services/audit", () => ({
  logAudit: vi.fn(),
  audit: { log: vi.fn(), logAndEmit: vi.fn() },
}));

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
      .mockResolvedValue({
        id: "fx-rate-1",
        base: "USD",
        quote: "CNY",
        rate: 7.1,
        effectiveFrom: new Date("2025-01-06T00:00:00.000Z"),
        effectiveTo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

    const mockFetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        rates: {
          "2025-01-06": { CNY: 7.1 },
          "2025-01-13": { CNY: 7.15 },
          "2025-01-20": { CNY: 7.18 },
        },
      }),
    })) as unknown as typeof fetch;

    setFxRateFetchImplementation(mockFetch);
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
    const statusUpdates = prismaMock.fxRateUpdateLog.update.mock.calls.map(
      (call: any[]) => call[0].data.status,
    );
    expect(statusUpdates).toContain("COMPLETED");

    upsertSpy.mockRestore();
    setFxRateFetchImplementation(null);
    resetFxUpdateServiceState();
    nowSpy.mockRestore();
  });
});
