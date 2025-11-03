import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventOutbox, Prisma, PrismaClient } from "@prisma/client";

const buildEventOutbox = (overrides: Partial<EventOutbox> = {}): EventOutbox => {
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

const eventOutboxDelegate = {
  create: vi.fn(async (_args: Prisma.EventOutboxCreateArgs) => buildEventOutbox()),
  findMany: vi.fn(async (_args: Prisma.EventOutboxFindManyArgs) => [] as EventOutbox[]),
  update: vi.fn(async (_args: Prisma.EventOutboxUpdateArgs) => buildEventOutbox()),
};

const mockPrisma = { eventOutbox: eventOutboxDelegate } as unknown as PrismaClient;

vi.mock("@/server/db", () => ({
  default: mockPrisma,
  prisma: mockPrisma,
}));

const buildTx = () => {
  const create = vi.fn(async (_args: Prisma.EventOutboxCreateArgs) => buildEventOutbox());
  const update = vi.fn(async (_args: Prisma.EventOutboxUpdateArgs) => buildEventOutbox());
  return {
    eventOutbox: {
      create,
      update,
    },
  } as unknown as Prisma.TransactionClient;
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
    eventOutboxDelegate.update.mockResolvedValueOnce(buildEventOutbox());
    await markOutboxEventDelivered(
      undefined as unknown as Prisma.TransactionClient,
      "evt-9",
    );
    expect(eventOutboxDelegate.update).toHaveBeenCalledWith({
      where: { id: "evt-9" },
      data: expect.objectContaining({ status: "DELIVERED" }),
    });
  });

  it("markOutboxEventFailed uses default client", async () => {
    const { markOutboxEventFailed } = await import("@/server/services/outbox");
    eventOutboxDelegate.update.mockResolvedValueOnce(buildEventOutbox());
    await markOutboxEventFailed(
      undefined as unknown as Prisma.TransactionClient,
      "evt-10",
      "boom",
      5_000,
    );
    expect(eventOutboxDelegate.update).toHaveBeenCalledWith({
      where: { id: "evt-10" },
      data: expect.objectContaining({
        status: "FAILED",
        lastError: "boom",
      }),
    });
  });
});
