import type { AuditLog, Prisma } from "@prisma/client";
import prisma from "@/server/db";
import { writeOutboxEvent } from "@/server/services/outbox";

export type AuditLogOptions = {
  userId?: string | null;
  meta?: unknown;
  client?: Prisma.TransactionClient | typeof prisma;
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
    client = prisma,
    emitEvent = false,
    eventType,
  } = options;
  const normalizedMeta =
    meta == null
      ? null
      : typeof meta === "string"
        ? meta
        : safeStringify(meta);
  const record = await client.auditLog.create({
    data: {
      action,
      userId,
      meta: normalizedMeta,
    },
  });
  if (emitEvent) {
    await writeOutboxEvent(client, {
      eventType: eventType ?? "audit.event.logged",
      payload: {
        auditId: record.id,
        action: record.action,
        userId: record.userId,
        meta,
        createdAt: record.createdAt.toISOString(),
      },
      occurredAt: record.createdAt,
    });
  }
  return record;
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
