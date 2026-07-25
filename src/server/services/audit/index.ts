import type { AuditLog } from "@/server/db/types";
import db from "@/server/db";
import { auditLogs } from "@/server/db/schema";
import { writeOutboxEvent } from "@/server/services/outbox";

export type AuditLogOptions = {
  userId?: string | null;
  meta?: unknown;
  client?: typeof db;
  emitEvent?: boolean;
  eventType?: string;
};

export type AuditService = {
  log: typeof logAudit;
  logAndEmit: (
    action: string,
    options?: Omit<AuditLogOptions, "emitEvent" | "eventType"> & {
      eventType?: string;
    },
  ) => Promise<AuditLog>;
};

export async function logAudit(
  action: string,
  options: AuditLogOptions = {},
): Promise<AuditLog> {
  const {
    userId = null,
    meta = null,
    client = db,
    emitEvent = false,
    eventType,
  } = options;
  const normalizedMeta =
    meta == null
      ? null
      : typeof meta === "string"
        ? meta
        : safeStringify(meta);
  const [created] = await client
    .insert(auditLogs)
    .values({
      action,
      userId,
      meta: normalizedMeta,
    })
    .returning();
  if (emitEvent) {
    await writeOutboxEvent(client, {
      eventType: eventType ?? "audit.event.logged",
      payload: {
        auditId: created.id,
        action: created.action,
        userId: created.userId,
        meta,
        createdAt: created.createdAt.toISOString(),
      },
      occurredAt: created.createdAt,
    });
  }
  return created;
}

export const audit: AuditService = {
  log: logAudit,
  logAndEmit: (action, options) =>
    logAudit(action, { ...options, emitEvent: true }),
};

export default audit;

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch (error) {
    throw new Error(
      `audit_meta_not_serializable: ${(error as Error).message}`,
    );
  }
}
