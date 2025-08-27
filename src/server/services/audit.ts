import prisma from "@/server/db";

export async function logAudit(action: string, opts?: { userId?: string; meta?: any }) {
  const meta = opts?.meta == null ? null : JSON.stringify(opts.meta);
  return prisma.auditLog.create({ data: { action, userId: opts?.userId || null, meta } });
}
