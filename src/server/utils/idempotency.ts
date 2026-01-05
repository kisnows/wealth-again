import db from "@/server/db";
import { idempotencyKeys } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function ensureIdempotent(
  req: Request,
  userId?: string,
  hash?: string,
) {
  const key =
    req.headers.get("Idempotency-Key") || req.headers.get("idempotency-key");
  if (!key) return { key: null, existed: false } as const;
  const [found] = await db
    .select()
    .from(idempotencyKeys)
    .where(eq(idempotencyKeys.key, key))
    .limit(1);
  if (found) return { key, existed: true } as const;
  await db.insert(idempotencyKeys).values({ key, userId, hash: hash || null });
  return { key, existed: false } as const;
}

export async function markIdempotencyUsed(key: string | null) {
  if (!key) return;
  await db
    .update(idempotencyKeys)
    .set({ usedAt: new Date() })
    .where(eq(idempotencyKeys.key, key));
}
