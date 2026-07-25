import type { EventOutbox } from "@/server/db/types";
import db from "@/server/db";
import { eventOutbox } from "@/server/db/schema";
import { and, asc, eq, lte, sql } from "drizzle-orm";

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

type DbWritableClient = typeof db;

export function writeOutboxEventSync(
  clientOrParams: DbWritableClient | WriteOutboxEventParams,
  params?: WriteOutboxEventParams,
): EventOutbox {
  const client =
    params === undefined ? db : (clientOrParams as DbWritableClient);
  const resolvedParams =
    params === undefined
      ? (clientOrParams as WriteOutboxEventParams)
      : params;
  const { eventType, payload, status = "PENDING", occurredAt, availableAt } =
    resolvedParams;
  if (!eventType || typeof eventType !== "string") {
    throw new Error("invalid_event_type");
  }
  const normalizedType = normalizeEventType(eventType);
  const serializedPayload = serializePayload(payload);
  const now = new Date();
  const created = client
    .insert(eventOutbox)
    .values({
      eventType: normalizedType,
      payload: serializedPayload,
      status,
      occurredAt: occurredAt ?? now,
      availableAt: availableAt ?? now,
    })
    .returning()
    .get();
  if (!created) {
    throw new Error("outbox_write_failed");
  }
  return created;
}

export async function writeOutboxEvent(
  clientOrParams: DbWritableClient | WriteOutboxEventParams,
  params?: WriteOutboxEventParams,
): Promise<EventOutbox> {
  return writeOutboxEventSync(clientOrParams as any, params as any);
}

export async function fetchPendingOutboxEvents(limit = 50): Promise<EventOutbox[]> {
  return db
    .select()
    .from(eventOutbox)
    .where(and(eq(eventOutbox.status, "PENDING"), lte(eventOutbox.availableAt, new Date())))
    .orderBy(asc(eventOutbox.availableAt))
    .limit(limit);
}

export async function markOutboxEventDelivered(
  client: DbWritableClient = db,
  id: string,
): Promise<void> {
  await client
    .update(eventOutbox)
    .set({
      status: "DELIVERED",
      processedAt: new Date(),
      lastError: null,
      attempts: sql`${eventOutbox.attempts} + 1`,
    })
    .where(eq(eventOutbox.id, id));
}

export async function markOutboxEventFailed(
  client: DbWritableClient = db,
  id: string,
  error: string,
  retryInMs = DEFAULT_RETRY_DELAY_MS,
): Promise<void> {
  const nextAttempt = new Date(Date.now() + Math.max(retryInMs, 5_000));
  await client
    .update(eventOutbox)
    .set({
      status: "FAILED",
      lastError: error,
      attempts: sql`${eventOutbox.attempts} + 1`,
      availableAt: nextAttempt,
    })
    .where(eq(eventOutbox.id, id));
}
