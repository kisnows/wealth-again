import { beforeEach, describe, expect, it, vi } from "vitest";

const eventOutboxDelegate = {
  create: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
};

vi.mock("@/server/db", () => ({
  default: { eventOutbox: eventOutboxDelegate } as any,
  prisma: { eventOutbox: eventOutboxDelegate } as any,
}));
const buildTx = () => {
  const create = vi.fn(async ({ data }: { data: any }) => ({
    id: "evt-mock",
    ...data,
  }));
  const update = vi.fn(async ({ data, where }: { data: any; where: any }) => ({
    id: where.id,
    ...data,
  }));
  return {
    eventOutbox: {
      create,
      update,
    },
  } as unknown as any;
};

describe("outbox service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventOutboxDelegate.create.mockReset();
    eventOutboxDelegate.findMany.mockReset();
    eventOutboxDelegate.update.mockReset();
  });

  it("writeOutboxEvent persists payload and metadata", async () => {
    const { writeOutboxEvent } = await import("@/server/services/outbox");
    const tx = buildTx();
    const created = await writeOutboxEvent(tx, {
      eventType: "ledger.entry.created",
      payload: { id: "entry-1", amount: 100 },
    });
    expect(created.eventType).toBe("ledger.entry.created");
    expect(tx.eventOutbox.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "ledger.entry.created",
        payload: { id: "entry-1", amount: 100 },
        status: "PENDING",
      }),
    });
  });

  it("markOutboxEventDelivered updates status", async () => {
    const { markOutboxEventDelivered } = await import("@/server/services/outbox");
    const tx = buildTx();
    await markOutboxEventDelivered(tx, "evt-1");
    expect(tx.eventOutbox.update).toHaveBeenCalledWith({
      where: { id: "evt-1" },
      data: expect.objectContaining({ status: "DELIVERED" }),
    });
  });

  it("markOutboxEventFailed schedules retry", async () => {
    const { markOutboxEventFailed } = await import("@/server/services/outbox");
    const tx = buildTx();
    await markOutboxEventFailed(tx, "evt-2", "boom", 10_000);
    expect(tx.eventOutbox.update).toHaveBeenCalledWith({
      where: { id: "evt-2" },
      data: expect.objectContaining({
        status: "FAILED",
        lastError: "boom",
      }),
    });
  });

  it("fetchPendingOutboxEvents returns due events", async () => {
    const now = new Date("2025-01-02T00:00:00Z");
    eventOutboxDelegate.findMany.mockResolvedValueOnce([
        {
          id: "evt-1",
          eventType: "income.recalc.completed",
          payload: { taskId: "task-1" },
        status: "PENDING",
        attempts: 1,
        lastError: null,
        occurredAt: now,
        availableAt: now,
        processedAt: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    const { fetchPendingOutboxEvents } = await import("@/server/services/outbox");
    const events = await fetchPendingOutboxEvents(5);
    expect(eventOutboxDelegate.findMany).toHaveBeenCalledWith({
      where: {
        status: "PENDING",
        availableAt: { lte: expect.any(Date) },
      },
      orderBy: { availableAt: "asc" },
      take: 5,
    });
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe("evt-1");
  });

  it("markOutboxEventDelivered uses default client", async () => {
    const { markOutboxEventDelivered } = await import("@/server/services/outbox");
    eventOutboxDelegate.update.mockResolvedValueOnce({} as any);
    await (markOutboxEventDelivered as any)(undefined, "evt-9");
    expect(eventOutboxDelegate.update).toHaveBeenCalledWith({
      where: { id: "evt-9" },
      data: expect.objectContaining({ status: "DELIVERED" }),
    });
  });

  it("markOutboxEventFailed uses default client", async () => {
    const { markOutboxEventFailed } = await import("@/server/services/outbox");
    eventOutboxDelegate.update.mockResolvedValueOnce({} as any);
    await (markOutboxEventFailed as any)(undefined, "evt-10", "boom", 5_000);
    expect(eventOutboxDelegate.update).toHaveBeenCalledWith({
      where: { id: "evt-10" },
      data: expect.objectContaining({
        status: "FAILED",
        lastError: "boom",
      }),
    });
  });
});
