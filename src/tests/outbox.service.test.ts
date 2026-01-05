import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventOutbox } from "@/server/db/types";
import {
  dbMock,
  queueInsertResults,
  queueSelectResults,
  queueUpdateResults,
  resetDbMock,
} from "@/tests/helpers/dbMock";

const buildEventOutbox = (
  overrides: Partial<EventOutbox> = {},
): EventOutbox => {
  const now = new Date();
  return {
    id: overrides.id ?? "evt-mock",
    eventType: overrides.eventType ?? "test.event",
    payload: overrides.payload ?? {},
    status: overrides.status ?? "PENDING",
    attempts: overrides.attempts ?? 0,
    lastError: overrides.lastError ?? null,
    occurredAt: overrides.occurredAt ?? now,
    availableAt: overrides.availableAt ?? now,
    processedAt: overrides.processedAt ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
};

describe("outbox service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMock();
  });

  it("writeOutboxEvent persists payload and metadata", async () => {
    const { writeOutboxEvent } = await import("@/server/services/outbox");
    const created = buildEventOutbox({
      id: "evt-1",
      eventType: "ledger.entry.created",
      payload: { id: "entry-1", amount: 100 },
    });
    queueInsertResults([created]);
    const result = await writeOutboxEvent(dbMock, {
      eventType: "ledger.entry.created",
      payload: { id: "entry-1", amount: 100 },
    });
    expect(result.eventType).toBe("ledger.entry.created");
  });

  it("writeOutboxEventSync can be used inside a sync transaction callback", async () => {
    // 场景：better-sqlite3 的 transaction 回调必须同步，outbox 写入也必须同步可用
    const { writeOutboxEventSync } = await import("@/server/services/outbox");
    const created = buildEventOutbox({
      id: "evt-sync-1",
      eventType: "ledger.entry.created",
      payload: { id: "entry-1", amount: 100 },
    });
    queueInsertResults([created]);
    const result = dbMock.transaction((tx) =>
      writeOutboxEventSync(tx as any, {
        eventType: "ledger.entry.created",
        payload: { id: "entry-1", amount: 100 },
      }),
    ) as EventOutbox;
    expect(result.id).toBe("evt-sync-1");
  });

  it("markOutboxEventDelivered updates status", async () => {
    const { markOutboxEventDelivered } = await import(
      "@/server/services/outbox"
    );
    queueUpdateResults({ changes: 1 });
    await markOutboxEventDelivered(dbMock, "evt-1");
  });

  it("markOutboxEventFailed schedules retry", async () => {
    const { markOutboxEventFailed } = await import("@/server/services/outbox");
    queueUpdateResults({ changes: 1 });
    await markOutboxEventFailed(dbMock, "evt-2", "boom", 10_000);
  });

  it("fetchPendingOutboxEvents returns due events", async () => {
    const now = new Date("2025-01-02T00:00:00Z");
    queueSelectResults([
      buildEventOutbox({
        id: "evt-1",
        eventType: "income.recalc.completed",
        payload: { taskId: "task-1" },
        attempts: 1,
        occurredAt: now,
        availableAt: now,
        createdAt: now,
        updatedAt: now,
      }),
    ]);
    const { fetchPendingOutboxEvents } = await import(
      "@/server/services/outbox"
    );
    const events = await fetchPendingOutboxEvents(5);
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe("evt-1");
  });

  it("markOutboxEventDelivered uses default client", async () => {
    const { markOutboxEventDelivered } = await import(
      "@/server/services/outbox"
    );
    queueUpdateResults({ changes: 1 });
    await markOutboxEventDelivered(undefined as unknown as typeof dbMock, "evt-9");
  });

  it("markOutboxEventFailed uses default client", async () => {
    const { markOutboxEventFailed } = await import("@/server/services/outbox");
    queueUpdateResults({ changes: 1 });
    await markOutboxEventFailed(
      undefined as unknown as typeof dbMock,
      "evt-10",
      "boom",
      5_000,
    );
  });
});
