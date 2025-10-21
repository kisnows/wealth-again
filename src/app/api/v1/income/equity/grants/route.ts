import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import { logAudit } from "@/server/services/audit";
import { scheduleIncomeRecalcTask } from "@/server/services/income";
import { getUserFromRequest } from "@/server/utils/auth";
import {
  ensureIdempotent,
  markIdempotencyUsed,
} from "@/server/utils/idempotency";

/**
 * GET /api/v1/income/equity/grants
 * - 列出股权激励授予。
 * POST /api/v1/income/equity/grants
 * - 新增授予。
 * - 入参: { userId: string, totalUnits: number, currency?: string, startVestDate: string(ISO), vestPeriods: number, vestInterval: "YEARLY"|"QUARTERLY" }
 */

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = user.id;
  const items = await prisma.equityGrant.findMany({
    where: { userId },
    orderBy: { startVestDate: "asc" },
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const {
    totalUnits,
    currency = "CNY",
    startVestDate,
    vestPeriods,
    vestInterval,
  } = (await req.json()) as {
    totalUnits: number;
    currency?: string;
    startVestDate: string;
    vestPeriods: number;
    vestInterval: "YEARLY" | "QUARTERLY" | "MONTHLY";
  };
  if (
    typeof totalUnits !== "number" ||
    !startVestDate ||
    !vestPeriods ||
    !vestInterval
  ) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const userId = user.id;
  const { key, existed } = await ensureIdempotent(
    req,
    userId,
    `${userId}:${totalUnits}:${startVestDate}:${vestPeriods}:${vestInterval}`,
  );
  if (existed)
    return NextResponse.json(
      { error: "Idempotency key reused" },
      { status: 409 },
    );
  const created = await prisma.equityGrant.create({
    data: {
      userId,
      totalUnits,
      currency,
      startVestDate: new Date(startVestDate),
      vestPeriods,
      vestInterval,
    },
  });
  const vestStart = new Date(startVestDate);
  if (!Number.isNaN(vestStart.getTime())) {
    await scheduleIncomeRecalcTask({
      userId,
      taxYear: vestStart.getUTCFullYear(),
      startMonth: vestStart.getUTCMonth() + 1,
      endMonth: 12,
      triggeredBy: user.id,
    });
  }
  await logAudit("INCOME_EQUITY_GRANT_CREATE", {
    userId,
    meta: { id: created.id },
  });
  await markIdempotencyUsed(key);
  return NextResponse.json(created, { status: 201 });
}
