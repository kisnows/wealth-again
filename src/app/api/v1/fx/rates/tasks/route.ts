import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SUPPORTED_CURRENCY_CODES } from "@/lib/domain/currency";
import db from "@/server/db";
import { fxRateUpdateTasks } from "@/server/db/schema";
import { logAudit } from "@/server/services/audit";
import { createManualFxRateUpdateTask } from "@/server/services/fx/update";
import { getUserFromRequest } from "@/server/utils/auth";
import {
  ensureIdempotent,
  markIdempotencyUsed,
} from "@/server/utils/idempotency";
import { and, desc, eq } from "drizzle-orm";

type CreateFxTaskPayload = {
  quote: string;
  startDate: string;
  endDate: string;
};

const BASE_CURRENCY = "USD";

function isSupportedQuote(code: string) {
  const upper = code.toUpperCase();
  return (
    upper !== BASE_CURRENCY &&
    SUPPORTED_CURRENCY_CODES.includes(
      upper as (typeof SUPPORTED_CURRENCY_CODES)[number],
    )
  );
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limitParam = searchParams.get("limit");
  const limit = Math.min(
    Math.max(Number.parseInt(limitParam ?? "50", 10) || 50, 1),
    200,
  );

  const filters = status ? [eq(fxRateUpdateTasks.status, status.toUpperCase())] : [];
  const tasks = await db
    .select()
    .from(fxRateUpdateTasks)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(fxRateUpdateTasks.scheduledFor), desc(fxRateUpdateTasks.createdAt))
    .limit(limit);

  return NextResponse.json({
    items: tasks.map((task) => ({
      id: task.id,
      base: task.base,
      quote: task.quote,
      startDate: task.startDate.toISOString(),
      endDate: task.endDate.toISOString(),
      status: task.status,
      scheduledFor: task.scheduledFor.toISOString(),
      processedAt: task.processedAt?.toISOString() ?? null,
      attempts: task.attempts,
      lastError: task.lastError ?? null,
      triggeredBy: task.triggeredBy ?? null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: CreateFxTaskPayload;
  try {
    payload = (await req.json()) as CreateFxTaskPayload;
  } catch (_error) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { quote, startDate, endDate } = payload;
  if (!quote || !startDate || !endDate) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (!isSupportedQuote(quote)) {
    return NextResponse.json(
      { error: "unsupported_currency" },
      { status: 422 },
    );
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }
  if (end < start) {
    return NextResponse.json({ error: "range_invalid" }, { status: 422 });
  }

  const idempotencyFingerprint = `${user.id}:${quote.toUpperCase()}:${start.toISOString()}:${end.toISOString()}`;
  const { key, existed } = await ensureIdempotent(
    req,
    user.id,
    idempotencyFingerprint,
  );
  if (existed) {
    return NextResponse.json({ error: "idempotent_conflict" }, { status: 409 });
  }

  try {
    const task = await createManualFxRateUpdateTask({
      quote: quote.toUpperCase(),
      startDate: start,
      endDate: end,
      triggeredBy: user.id,
    });
    await logAudit("FX_RATE_UPDATE_TASK_CREATED", {
      userId: user.id,
      meta: {
        taskId: task.id,
        quote: task.quote,
        startDate: task.startDate.toISOString(),
        endDate: task.endDate.toISOString(),
      },
    });
    await markIdempotencyUsed(key);
    return NextResponse.json(
      {
        id: task.id,
        quote: task.quote,
        startDate: task.startDate.toISOString(),
        endDate: task.endDate.toISOString(),
        status: task.status,
        scheduledFor: task.scheduledFor.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("create fx update task failed", error);
    return NextResponse.json({ error: "create_task_failed" }, { status: 500 });
  }
}
