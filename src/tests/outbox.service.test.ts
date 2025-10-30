import { beforeEach, describe, expect, it, vi } from "vitest";
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
    vi.clearAllMocks();
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
});
