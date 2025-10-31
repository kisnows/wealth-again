import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import { audit } from "@/server/services/audit";
import { scheduleIncomeRecalcTask } from "@/server/services/income-tax/income";
import { getUserFromRequest } from "@/server/utils/auth";
import {
  ensureIdempotent,
  markIdempotencyUsed,
} from "@/server/utils/idempotency";

function getNextUtcMonthStart(base = new Date()) {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1));
}

function normalizeToUtcMonth(input: string | Date): Date {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) {
    throw new Error("invalid-date");
  }
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/**
 * GET /api/v1/identity/city-changes
 * - 获取当前用户的城市变更记录
 * - 返回: Array<CityChangeRecord>
 */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = user.id;

  try {
    const me = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        currentCity: { select: { id: true, name: true, country: true } },
      },
    });

    const cityChanges = await prisma.cityChangeRecord.findMany({
      where: { userId },
      include: {
        toCity: {
          select: { id: true, name: true, country: true },
        },
        fromCity: {
          select: { id: true, name: true, country: true },
        },
      },
      orderBy: { effectiveMonth: "desc" },
    });

    return NextResponse.json({
      currentCity: me?.currentCity ?? null,
      items: cityChanges,
    });
  } catch (error) {
    console.error("Get city changes error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/v1/identity/city-changes
 * - 添加城市变更记录
 * - 入参: { toCityId: string, effectiveMonth?: string, reason?: string }
 * - 返回: 创建的记录
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = user.id;

  try {
    const data = await req.json();
    const { toCityId, effectiveMonth: monthInput, reason } = data ?? {};

    if (!toCityId) {
      return NextResponse.json(
        { error: "toCityId is required" },
        { status: 400 },
      );
    }

    const me = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        currentCity: { select: { id: true, name: true, country: true } },
      },
    });
    if (!me) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }

    // 验证城市是否存在
    const city = await prisma.city.findUnique({
      where: { id: toCityId },
      select: { id: true, name: true, country: true },
    });
    if (!city) {
      return NextResponse.json({ error: "city_not_found" }, { status: 404 });
    }

    if (me.currentCity && city.country !== me.currentCity.country) {
      return NextResponse.json(
        { error: "暂不支持跨国家城市变更，请联系管理员处理" },
        { status: 400 },
      );
    }

    let effectiveMonth: Date;
    try {
      if (monthInput) {
        effectiveMonth = normalizeToUtcMonth(monthInput);
      } else {
        effectiveMonth = getNextUtcMonthStart();
      }
    } catch (_error) {
      return NextResponse.json(
        { error: "effectiveMonth invalid" },
        { status: 400 },
      );
    }

    const todayMonth = normalizeToUtcMonth(new Date());
    if (effectiveMonth <= todayMonth) {
      return NextResponse.json(
        { error: "effectiveMonth must be greater than current month" },
        { status: 400 },
      );
    }

    const latestChange = await prisma.cityChangeRecord.findFirst({
      where: { userId },
      orderBy: { effectiveMonth: "desc" },
    });
    if (latestChange && effectiveMonth <= latestChange.effectiveMonth) {
      return NextResponse.json(
        { error: "effectiveMonth must be later than existing records" },
        { status: 409 },
      );
    }

    const { key, existed } = await ensureIdempotent(
      req,
      userId,
      `${userId}:${toCityId}:${effectiveMonth.toISOString()}`,
    );
    if (existed) {
      return NextResponse.json(
        { error: "Idempotency key reused" },
        { status: 409 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const cityChange = await tx.cityChangeRecord.create({
        data: {
          userId,
          toCityId,
          fromCityId: me.currentCityId ?? null,
          effectiveMonth,
          reason: reason || null,
        },
        include: {
          toCity: {
            select: { id: true, name: true, country: true },
          },
          fromCity: {
            select: { id: true, name: true, country: true },
          },
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { currentCityId: toCityId },
      });

      return cityChange;
    });

    const taxYear = effectiveMonth.getUTCFullYear();
    const monthIndex = effectiveMonth.getUTCMonth() + 1;
    const taskId = await scheduleIncomeRecalcTask({
      userId,
      taxYear,
      startMonth: monthIndex,
      endMonth: 12,
      cityId: toCityId,
      triggeredBy: userId,
      delayMs: 0,
    });

    await audit.logAndEmit("CITY_CHANGE_CREATE", {
      userId,
      meta: {
        cityChangeId: result.id,
        toCityId,
        fromCityId: me.currentCityId ?? null,
        effectiveMonth: effectiveMonth.toISOString(),
        reason,
        taskId,
      },
      eventType: "audit.identity.city_change_created",
    });

    await markIdempotencyUsed(key);

    return NextResponse.json(
      { cityChange: result, task: { id: taskId, status: "PENDING" } },
      { status: 202 },
    );
  } catch (error) {
    console.error("Create city change error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
