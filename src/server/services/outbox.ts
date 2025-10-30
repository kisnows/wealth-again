import type { EventOutbox, Prisma } from "@prisma/client";
import prisma from "@/server/db";

export type OutboxStatus = "PENDING" | "DELIVERED" | "FAILED";

export type WriteOutboxEventParams = {
  eventType: string;
  payload: unknown;
  status?: OutboxStatus;
  occurredAt?: Date;
  availableAt?: Date;
};

const DEFAULT_RETRY_DELAY_MS = 60_000;

function normalizeEventType(type: string): string {
  const trimmed = type.trim();
  if (!trimmed) throw new Error("event_type_required");
  return trimmed;
}

function serializePayload(payload: unknown): unknown {
  if (payload == null) return {};
  try {
    return JSON.parse(JSON.stringify(payload));
  } catch (error) {
    throw new Error(`outbox_payload_not_serializable: ${(error as Error).message}`);
  }
}

type PrismaWritableClient = Prisma.TransactionClient | typeof prisma;

export async function writeOutboxEvent(
  client: PrismaWritableClient,
  params: WriteOutboxEventParams,
): Promise<EventOutbox> {
  const { eventType, payload, status = "PENDING", occurredAt, availableAt } = params;
  if (!eventType || typeof eventType !== "string") {
    throw new Error("invalid_event_type");
  }
  const normalizedType = normalizeEventType(eventType);
  const serializedPayload = serializePayload(payload);
  const now = new Date();
  return client.eventOutbox.create({
    data: {
      eventType: normalizedType,
      payload: serializedPayload,
      status,
      occurredAt: occurredAt ?? now,
      availableAt: availableAt ?? now,
    },
  });
}

export async function fetchPendingOutboxEvents(limit = 50): Promise<EventOutbox[]> {
  return prisma.eventOutbox.findMany({
    where: {
      status: "PENDING",
      availableAt: { lte: new Date() },
    },
    orderBy: { availableAt: "asc" },
    take: limit,
  });
}

export async function markOutboxEventDelivered(
  client: PrismaWritableClient = prisma,
  id: string,
): Promise<void> {
  await client.eventOutbox.update({
    where: { id },
    data: {
      status: "DELIVERED",
      processedAt: new Date(),
      lastError: null,
      attempts: { increment: 1 },
    },
  });
}

export async function markOutboxEventFailed(
  client: PrismaWritableClient = prisma,
  id: string,
  error: string,
  retryInMs = DEFAULT_RETRY_DELAY_MS,
): Promise<void> {
  const nextAttempt = new Date(Date.now() + Math.max(retryInMs, 5_000));
  await client.eventOutbox.update({
    where: { id },
    data: {
      status: "FAILED",
      lastError: error,
      attempts: { increment: 1 },
      availableAt: nextAttempt,
    },
  });
}
