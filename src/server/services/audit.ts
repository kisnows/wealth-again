import prisma from "@/server/db";

export async function logAudit(action: string, opts?: { userId?: string; meta?: any }) {
  return prisma.auditLog.create({ data: { action, userId: opts?.userId || null, meta: opts?.meta || null } });
}

