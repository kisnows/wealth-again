import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import { ensureIdempotent, markIdempotencyUsed } from "@/server/utils/idempotency";
import { logAudit } from "@/server/services/audit";

/**
 * GET /api/v1/income/equity/grants
 * - 列出股权激励授予。
 * POST /api/v1/income/equity/grants
 * - 新增授予。
 * - 入参: { userId: string, totalUnits: number, currency?: string, startVestDate: string(ISO), vestPeriods: number, vestInterval: "YEARLY"|"QUARTERLY" }
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || undefined;
  const items = await prisma.equityGrant.findMany({ where: { userId }, orderBy: { startVestDate: "asc" } });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const { userId, totalUnits, currency = "CNY", startVestDate, vestPeriods, vestInterval } = await req.json();
  if (!userId || typeof totalUnits !== "number" || !startVestDate || !vestPeriods || !vestInterval) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { key, existed } = await ensureIdempotent(req as any, userId, `${userId}:${totalUnits}:${startVestDate}:${vestPeriods}:${vestInterval}`);
  if (existed) return NextResponse.json({ error: "Idempotency key reused" }, { status: 409 });
  const created = await prisma.equityGrant.create({ data: { userId, totalUnits, currency, startVestDate: new Date(startVestDate), vestPeriods, vestInterval } });
  await logAudit("INCOME_EQUITY_GRANT_CREATE", { userId, meta: { id: created.id } });
  await markIdempotencyUsed(key);
  return NextResponse.json(created, { status: 201 });
}
