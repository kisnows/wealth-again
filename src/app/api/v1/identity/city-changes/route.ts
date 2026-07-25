import { type NextRequest, NextResponse } from "next/server";
import db from "@/server/db";
import { cities, cityChangeRecords, users } from "@/server/db/schema";
import { audit } from "@/server/services/audit";
import { scheduleIncomeRecalcTask } from "@/server/services/income-tax/income";
import { getUserFromRequest } from "@/server/utils/auth";
import {
  ensureIdempotent,
  markIdempotencyUsed,
} from "@/server/utils/idempotency";
import { desc, eq, inArray } from "drizzle-orm";

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
    const [me] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const cityChanges = await db
      .select()
      .from(cityChangeRecords)
      .where(eq(cityChangeRecords.userId, userId))
      .orderBy(desc(cityChangeRecords.effectiveMonth));

    const cityIds = Array.from(
      new Set(
        cityChanges
          .flatMap((row) => [row.toCityId, row.fromCityId])
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const cityRows =
      cityIds.length === 0
        ? []
        : await db
            .select()
            .from(cities)
            .where(inArray(cities.id, cityIds));
    const cityMap = new Map(cityRows.map((row) => [row.id, row]));

    return NextResponse.json({
      currentCity: me?.currentCityId
        ? cityMap.get(me.currentCityId) ?? null
        : null,
      items: cityChanges.map((row) => ({
        ...row,
        toCity: row.toCityId ? cityMap.get(row.toCityId) ?? null : null,
        fromCity: row.fromCityId ? cityMap.get(row.fromCityId) ?? null : null,
      })),
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

    const [me] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!me) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }

    // 验证城市是否存在
    const [city] = await db
      .select({
        id: cities.id,
        name: cities.name,
        country: cities.country,
      })
      .from(cities)
      .where(eq(cities.id, toCityId))
      .limit(1);
    if (!city) {
      return NextResponse.json({ error: "city_not_found" }, { status: 404 });
    }

    if (me.currentCityId) {
      const [currentCity] = await db
        .select()
        .from(cities)
        .where(eq(cities.id, me.currentCityId))
        .limit(1);
      if (currentCity && city.country !== currentCity.country) {
        return NextResponse.json(
          { error: "暂不支持跨国家城市变更，请联系管理员处理" },
          { status: 400 },
        );
      }
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

    const [latestChange] = await db
      .select()
      .from(cityChangeRecords)
      .where(eq(cityChangeRecords.userId, userId))
      .orderBy(desc(cityChangeRecords.effectiveMonth))
      .limit(1);
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

    const result = await db.transaction((tx) => {
      const cityChange = tx
        .insert(cityChangeRecords)
        .values({
          userId,
          toCityId,
          fromCityId: me.currentCityId ?? null,
          effectiveMonth,
          reason: reason || null,
        })
        .returning()
        .get();
      if (!cityChange) {
        throw new Error("city_change_create_failed");
      }

      tx
        .update(users)
        .set({ currentCityId: toCityId })
        .where(eq(users.id, userId))
        .run();

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
