import type { FxRateUpdateTask, Prisma } from "@prisma/client";
import prisma from "@/server/db";
import { logAudit } from "@/server/services/audit";
import { upsertFxRateWithContinuity } from "@/server/services/fx/rate-writer";
import {
  SUPPORTED_CURRENCY_CODES,
  type SupportedCurrencyCode,
} from "@/lib/domain/currency";

type FxRateUpdateStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

const BASE_CURRENCY = "USD";
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const COVERAGE_LOOKBACK_DAYS = 365;
const COVERAGE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

let fxFetchImpl: typeof fetch | null = null;
let lastCoverageCheck = 0;

export function setFxRateFetchImplementation(fn: typeof fetch | null) {
  fxFetchImpl = fn;
}

const LOG_STATUS = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
} as const;

type LogStatus = (typeof LOG_STATUS)[keyof typeof LOG_STATUS];

async function startLogEntry(taskId: string, weekStart: Date, weekEnd: Date) {
  const now = new Date();
  return prisma.fxRateUpdateLog.upsert({
    where: {
      taskId_weekStart: {
        taskId,
        weekStart,
      },
    },
    update: {
      status: LOG_STATUS.RUNNING,
      attempts: { increment: 1 },
      weekEnd,
      startedAt: now,
      updatedAt: now,
    },
    create: {
      taskId,
      weekStart,
      weekEnd,
      status: LOG_STATUS.RUNNING,
      attempts: 1,
      startedAt: now,
    },
  });
}

async function updateLogEntry(
  logId: string,
  status: LogStatus,
  data: Partial<{
    rate: number | null;
    lastError: string | null;
  }>,
) {
  const now = new Date();
  await prisma.fxRateUpdateLog.update({
    where: { id: logId },
    data: {
      status,
      rate: data.rate ?? null,
      lastError: data.lastError ?? null,
      completedAt:
        status === LOG_STATUS.COMPLETED ||
        status === LOG_STATUS.FAILED ||
        status === LOG_STATUS.SKIPPED
          ? now
          : undefined,
      updatedAt: now,
    },
  });
}

function normalizeDate(input: Date): Date {
  const d = new Date(input);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function startOfIsoWeek(date: Date): Date {
  const normalized = normalizeDate(date);
  const day = normalized.getUTCDay() || 7; // treat Sunday as 7
  const diff = day - 1;
  return new Date(normalized.getTime() - diff * MS_PER_DAY);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

type EnqueueFxRateUpdateOptions = {
  base?: string;
  quote: string;
  startDate: Date;
  endDate: Date;
  triggeredBy?: string | null;
  delayMs?: number;
  tx?: Prisma.TransactionClient;
};

export async function enqueueFxRateUpdateTask(
  options: EnqueueFxRateUpdateOptions,
): Promise<FxRateUpdateTask> {
  const {
    base = BASE_CURRENCY,
    quote,
    startDate,
    endDate,
    triggeredBy = null,
    delayMs = 0,
    tx,
  } = options;
  const normalizedBase = base.toUpperCase();
  const normalizedQuote = quote.toUpperCase();
  const normalizedStart = normalizeDate(startDate);
  const normalizedEnd = normalizeDate(endDate);
  if (normalizedEnd < normalizedStart) {
    throw new Error("fx_update_range_invalid");
  }
  const scheduledFor = new Date(Date.now() + Math.max(delayMs, 0));
  const runner = tx ?? prisma;

  return runner.$transaction(async (trx) => {
    const scoped = trx.fxRateUpdateTask;
    const existing = await scoped.findFirst({
      where: {
        base: normalizedBase,
        quote: normalizedQuote,
        status: "PENDING",
        startDate: { lte: normalizedEnd },
        endDate: { gte: normalizedStart },
      },
      orderBy: { scheduledFor: "asc" },
    });
    if (existing) {
      return scoped.update({
        where: { id: existing.id },
        data: {
          startDate:
            normalizedStart < existing.startDate
              ? normalizedStart
              : existing.startDate,
          endDate:
            normalizedEnd > existing.endDate ? normalizedEnd : existing.endDate,
          scheduledFor,
          triggeredBy: triggeredBy ?? existing.triggeredBy,
        },
      });
    }
    return scoped.create({
      data: {
        base: normalizedBase,
        quote: normalizedQuote,
        startDate: normalizedStart,
        endDate: normalizedEnd,
        scheduledFor,
        triggeredBy,
      },
    });
  });
}

export async function fetchPendingFxRateUpdateTasks(
  limit = 5,
): Promise<FxRateUpdateTask[]> {
  return prisma.fxRateUpdateTask.findMany({
    where: {
      status: "PENDING",
      scheduledFor: { lte: new Date() },
    },
    orderBy: { scheduledFor: "asc" },
    take: limit,
  });
}

export async function markFxRateUpdateRunning(
  task: FxRateUpdateTask,
): Promise<boolean> {
  const result = await prisma.fxRateUpdateTask.updateMany({
    where: { id: task.id, status: "PENDING" },
    data: {
      status: "RUNNING",
      attempts: task.attempts + 1,
      updatedAt: new Date(),
    },
  });
  return result.count > 0;
}

export async function markFxRateUpdateCompleted(
  taskId: string,
  inserted: number,
): Promise<void> {
  await prisma.fxRateUpdateTask.update({
    where: { id: taskId },
    data: {
      status: "COMPLETED",
      processedAt: new Date(),
      lastError: null,
      updatedAt: new Date(),
    },
  });
  await logAudit("FX_RATE_UPDATE_COMPLETED", {
    userId: null,
    meta: { taskId, inserted },
  });
}

export async function markFxRateUpdateFailed(
  task: FxRateUpdateTask,
  message: string,
  retryDelayMs = 30 * 60 * 1000,
): Promise<void> {
  await prisma.fxRateUpdateTask.update({
    where: { id: task.id },
    data: {
      status:
        task.attempts + 1 >= 5 ? ("FAILED" as FxRateUpdateStatus) : "PENDING",
      lastError: message,
      scheduledFor: new Date(Date.now() + retryDelayMs),
      attempts: task.attempts + 1,
      updatedAt: new Date(),
    },
  });
  await logAudit("FX_RATE_UPDATE_FAILED", {
    userId: null,
    meta: { taskId: task.id, error: message },
  });
}

type FxTimeseriesResponse = {
  rates: Record<string, Record<string, number>>;
};

async function fetchFxTimeseries(
  base: string,
  quote: string,
  startDate: Date,
  endDate: Date,
): Promise<FxTimeseriesResponse> {
  const fetcher = fxFetchImpl ?? fetch;
  const url = new URL("https://api.exchangerate.host/timeseries");
  url.searchParams.set("base", base.toUpperCase());
  url.searchParams.set("symbols", quote.toUpperCase());
  url.searchParams.set("start_date", formatIsoDate(startDate));
  url.searchParams.set("end_date", formatIsoDate(endDate));
  const res = await fetcher(url.toString(), { method: "GET" });
  if (!res.ok) {
    throw new Error(`fx_provider_http_${res.status}`);
  }
  const data = (await res.json()) as FxTimeseriesResponse & {
    success?: boolean;
    error?: string;
  };
  if (!data || typeof data.rates !== "object") {
    throw new Error("fx_provider_invalid_payload");
  }
  return data;
}

function buildMissingWeekRanges(
  records: Array<{ effectiveFrom: Date }>,
  rangeStart: Date,
  rangeEnd: Date,
): Array<{ start: Date; end: Date }> {
  const weeksMissing: Date[] = [];
  const startWeek = startOfIsoWeek(rangeStart);
  const endWeek = startOfIsoWeek(rangeEnd);
  const sortedRecords = records
    .map((item) => normalizeDate(item.effectiveFrom))
    .sort((a, b) => a.getTime() - b.getTime());

  let cursor = new Date(startWeek);
  while (cursor.getTime() <= endWeek.getTime()) {
    const weekStart = new Date(cursor);
    const weekEndExclusive = addDays(weekStart, 7);
    const hasRecord = sortedRecords.some((item) => {
      const time = item.getTime();
      return time >= weekStart.getTime() && time < weekEndExclusive.getTime();
    });
    if (!hasRecord) {
      weeksMissing.push(weekStart);
    }
    cursor = addDays(cursor, 7);
  }

  if (weeksMissing.length === 0) return [];

  const ranges: Array<{ start: Date; end: Date }> = [];
  let currentStart: Date | null = null;
  let previousWeek: Date | null = null;

  weeksMissing.forEach((week) => {
    if (!currentStart) {
      currentStart = new Date(week);
      previousWeek = new Date(week);
      return;
    }
    const expected = addDays(previousWeek!, 7);
    if (week.getTime() === expected.getTime()) {
      previousWeek = new Date(week);
      return;
    }
    const blockEnd = addDays(previousWeek!, 6);
    ranges.push({
      start: currentStart < rangeStart ? rangeStart : currentStart,
      end: blockEnd > rangeEnd ? rangeEnd : blockEnd,
    });
    currentStart = new Date(week);
    previousWeek = new Date(week);
  });

  if (currentStart && previousWeek) {
    const blockEnd = addDays(previousWeek, 6);
    ranges.push({
      start: currentStart < rangeStart ? rangeStart : currentStart,
      end: blockEnd > rangeEnd ? rangeEnd : blockEnd,
    });
  }

  return ranges;
}

function buildWeekAnchors(start: Date, end: Date): Date[] {
  const anchors: Date[] = [];
  let cursor = startOfIsoWeek(start);
  const limit = startOfIsoWeek(end);
  while (cursor.getTime() <= limit.getTime()) {
    const clamped = cursor < start ? new Date(start) : new Date(cursor);
    anchors.push(clamped);
    cursor = addDays(cursor, 7);
  }
  return anchors;
}

function pickRateForWeek(
  rates: Record<string, Record<string, number>>,
  quote: string,
  weekStart: Date,
  weekEnd: Date,
): number | null {
  const limit = weekEnd.getTime();
  for (
    let cursor = new Date(weekStart);
    cursor.getTime() <= limit;
    cursor = addDays(cursor, 1)
  ) {
    const key = formatIsoDate(cursor);
    const value = rates[key]?.[quote];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return null;
}

async function runFxRateUpdateTask(task: FxRateUpdateTask): Promise<number> {
  const startDate = normalizeDate(task.startDate);
  const endDate = normalizeDate(task.endDate);
  if (endDate < startDate) return 0;

  const response = await fetchFxTimeseries(
    task.base,
    task.quote,
    startDate,
    endDate,
  );
  const weekAnchors = buildWeekAnchors(startDate, endDate);
  let inserted = 0;
  const recentThreshold = Date.now() - 7 * MS_PER_DAY;
  const isRecentRange = endDate.getTime() >= recentThreshold;

  for (let i = 0; i < weekAnchors.length; i += 1) {
    const weekStart = weekAnchors[i];
    const isLast = i === weekAnchors.length - 1;
    const weekEnd = isLast ? endDate : addDays(weekStart, 6);
    const log = await startLogEntry(task.id, weekStart, weekEnd);
    const rate = pickRateForWeek(
      response.rates,
      task.quote,
      weekStart,
      weekEnd,
    );
    if (rate == null) {
      await updateLogEntry(log.id, LOG_STATUS.SKIPPED, {
        rate: null,
        lastError: "rate_missing",
      });
      continue;
    }
    const effectiveFrom = weekStart;
    const effectiveTo = isLast && isRecentRange ? null : addDays(weekStart, 7);
    try {
      await upsertFxRateWithContinuity({
        base: task.base,
        quote: task.quote,
        rate,
        effectiveFrom,
        effectiveTo,
      });
      inserted += 1;
      await updateLogEntry(log.id, LOG_STATUS.COMPLETED, {
        rate,
        lastError: null,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "fx_rate_write_failed";
      await updateLogEntry(log.id, LOG_STATUS.FAILED, {
        rate: null,
        lastError: message,
      });
      throw error;
    }
  }
  return inserted;
}

async function fetchLatestRate(
  base: string,
  quote: string,
): Promise<{
  rate: number;
  asOf: Date;
}> {
  const fetcher = fxFetchImpl ?? fetch;
  const url = new URL("https://api.exchangerate.host/latest");
  url.searchParams.set("base", base.toUpperCase());
  url.searchParams.set("symbols", quote.toUpperCase());
  const res = await fetcher(url.toString(), { method: "GET" });
  if (!res.ok) {
    throw new Error(`fx_provider_latest_http_${res.status}`);
  }
  const data = (await res.json()) as {
    rates?: Record<string, number>;
    date?: string;
  };
  const rate = data.rates?.[quote.toUpperCase()];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new Error("fx_provider_latest_missing");
  }
  const asOfRaw = data.date ? new Date(`${data.date}T00:00:00Z`) : new Date();
  const asOf = normalizeDate(asOfRaw);
  return { rate, asOf };
}

export async function processDueFxRateUpdateTasks(limit = 3): Promise<{
  processed: number;
  results: Array<{ taskId: string; inserted: number }>;
}> {
  const dueTasks = await fetchPendingFxRateUpdateTasks(limit);
  const results: Array<{ taskId: string; inserted: number }> = [];

  for (const task of dueTasks) {
    const claimed = await markFxRateUpdateRunning(task);
    if (!claimed) continue;
    try {
      const inserted = await runFxRateUpdateTask(task);
      await markFxRateUpdateCompleted(task.id, inserted);
      results.push({ taskId: task.id, inserted });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "fx_update_unknown_error";
      await markFxRateUpdateFailed(task, message);
    }
  }

  return { processed: results.length, results };
}

export async function refreshLatestFxRate({
  quote,
  triggeredBy,
}: {
  quote: string;
  triggeredBy?: string | null;
}) {
  const normalizedQuote = quote.toUpperCase();
  if (normalizedQuote === BASE_CURRENCY) {
    throw new Error("fx_refresh_same_currency_not_allowed");
  }
  if (
    !SUPPORTED_CURRENCY_CODES.includes(normalizedQuote as SupportedCurrencyCode)
  ) {
    throw new Error("fx_refresh_unsupported_currency");
  }
  const { rate, asOf } = await fetchLatestRate(BASE_CURRENCY, normalizedQuote);
  const record = await upsertFxRateWithContinuity({
    base: BASE_CURRENCY,
    quote: normalizedQuote,
    rate,
    effectiveFrom: asOf,
    effectiveTo: null,
  });
  await logAudit("FX_RATE_REFRESHED", {
    userId: triggeredBy ?? null,
    meta: {
      fxRateId: record.id,
      base: record.base,
      quote: record.quote,
      rate: Number(record.rate),
      effectiveFrom: record.effectiveFrom.toISOString(),
    },
  });
  return record;
}

export async function ensureWeeklyFxCoverage(
  options: { base?: string; asOf?: Date; lookbackDays?: number } = {},
): Promise<number> {
  const now = Date.now();
  if (now - lastCoverageCheck < COVERAGE_CHECK_INTERVAL_MS) {
    return 0;
  }
  lastCoverageCheck = now;
  const {
    base = BASE_CURRENCY,
    asOf = new Date(),
    lookbackDays = COVERAGE_LOOKBACK_DAYS,
  } = options;
  const normalizedBase = base.toUpperCase();
  const endDate = normalizeDate(asOf);
  const startDate = normalizeDate(addDays(endDate, -Math.abs(lookbackDays)));
  const quotes = SUPPORTED_CURRENCY_CODES.filter(
    (code) => code.toUpperCase() !== normalizedBase,
  );
  let scheduled = 0;

  for (const quote of quotes) {
    const records = await prisma.fxRate.findMany({
      where: {
        base: normalizedBase,
        quote: quote.toUpperCase(),
        effectiveFrom: { gte: startDate },
      },
      select: { effectiveFrom: true },
      orderBy: { effectiveFrom: "asc" },
    });
    const missingRanges = buildMissingWeekRanges(records, startDate, endDate);
    for (const range of missingRanges) {
      await enqueueFxRateUpdateTask({
        base: normalizedBase,
        quote,
        startDate: range.start,
        endDate: range.end,
        triggeredBy: "system",
      });
      scheduled += 1;
    }
  }
  return scheduled;
}

export async function createManualFxRateUpdateTask({
  quote,
  startDate,
  endDate,
  triggeredBy,
}: {
  quote: string;
  startDate: Date;
  endDate: Date;
  triggeredBy?: string | null;
}): Promise<FxRateUpdateTask> {
  return enqueueFxRateUpdateTask({
    quote,
    startDate,
    endDate,
    triggeredBy: triggeredBy ?? null,
  });
}

export function resetFxUpdateServiceState() {
  lastCoverageCheck = 0;
  fxFetchImpl = null;
}
