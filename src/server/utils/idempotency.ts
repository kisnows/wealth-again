import prisma from "@/server/db";

export async function ensureIdempotent(
  req: Request,
  userId?: string,
  hash?: string,
) {
  const key =
    req.headers.get("Idempotency-Key") || req.headers.get("idempotency-key");
  if (!key) return { key: null, existed: false } as const;
  const found = await prisma.idempotencyKey.findUnique({ where: { key } });
  if (found) return { key, existed: true } as const;
  await prisma.idempotencyKey.create({
    data: { key, userId, hash: hash || null },
  });
  return { key, existed: false } as const;
}

export async function markIdempotencyUsed(key: string | null) {
  if (!key) return;
  await prisma.idempotencyKey.update({
    where: { key },
    data: { usedAt: new Date() },
  });
}
