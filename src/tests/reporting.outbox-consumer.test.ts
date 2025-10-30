import { beforeEach, describe, expect, it, vi } from "vitest";

const refreshAccountsSummaryDataset = vi.fn().mockResolvedValue({
  summary: { items: [], totals: { assets: 0, liabilities: 0, netWorth: 0, archived: 0 }, displayCurrency: null },
  generatedAt: new Date(),
  payload: {
    generatedAt: new Date().toISOString(),
    totals: { assets: 0, liabilities: 0, netWorth: 0, archived: 0 },
    displayCurrency: null,
    items: [],
  },
});

const refreshIncomeReportingDataset = vi
  .fn()
  .mockResolvedValue({ items: [], summary: {}, generatedAt: new Date() });

vi.mock("@/server/services/reporting/updaters", () => ({
  refreshAccountsSummaryDataset,
  refreshIncomeReportingDataset,
}));

describe("Reporting outbox consumer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles ledger events for accounts summary", async () => {
    // 场景：账本事件触发报表刷新，应调用账户汇总更新。
    const { consumeReportingEvent } = await import(
      "@/server/services/reporting/outbox-consumer"
    );
    const occurredAt = new Date("2025-01-02T03:04:05Z");
    const result = await consumeReportingEvent({
      id: "evt-ledger",
      eventType: "ledger.entry.created",
      payload: { userId: "u1" },
      occurredAt,
      createdAt: occurredAt,
      availableAt: occurredAt,
      status: "PENDING",
      attempts: 0,
      updatedAt: occurredAt,
      processedAt: null,
      lastError: null,
    } as any);
    expect(result.handled).toBe(true);
    expect(refreshAccountsSummaryDataset).toHaveBeenCalledWith("u1", occurredAt);
  });

  it("handles income events for monthly dataset", async () => {
    // 场景：收入回算事件触发收入报表刷新，应调用收入月度聚合。
    const { consumeReportingEvent } = await import(
      "@/server/services/reporting/outbox-consumer"
    );
    const occurredAt = new Date("2025-02-10T00:00:00Z");
    const result = await consumeReportingEvent({
      id: "evt-income",
      eventType: "income.recalc.completed",
      payload: { userId: "u9" },
      occurredAt,
      createdAt: occurredAt,
      availableAt: occurredAt,
      status: "PENDING",
      attempts: 0,
      updatedAt: occurredAt,
      processedAt: null,
      lastError: null,
    } as any);
    expect(result.handled).toBe(true);
    expect(refreshIncomeReportingDataset).toHaveBeenCalledWith("u9", occurredAt);
  });

  it("skips unknown events", async () => {
    // 场景：未注册事件类型应直接跳过，避免错误。
    const { consumeReportingEvent } = await import(
      "@/server/services/reporting/outbox-consumer"
    );
    const result = await consumeReportingEvent({
      id: "evt-unknown",
      eventType: "fx.rate.updated",
      payload: { base: "USD" },
      occurredAt: new Date(),
      createdAt: new Date(),
      availableAt: new Date(),
      status: "PENDING",
      attempts: 0,
      updatedAt: new Date(),
      processedAt: null,
      lastError: null,
    } as any);
    expect(result.handled).toBe(false);
    expect(result.reason).toBe("event_type_unhandled");
    expect(refreshAccountsSummaryDataset).not.toHaveBeenCalled();
    expect(refreshIncomeReportingDataset).not.toHaveBeenCalled();
  });
});
