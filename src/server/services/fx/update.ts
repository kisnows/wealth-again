import type { FxRateUpdateTask, Prisma } from "@prisma/client";
import prisma from "@/server/db";
import { logAudit } from "@/server/services/audit";
import { clearFxCache } from "@/server/services/fx";
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
const FRANKFURTER_BASE_URL = "https://api.frankfurter.app";
const EXCHANGERATE_HOST_BASE_URL = "https://api.exchangerate.host";

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

function getExchangerateHostApiKey(): string {
  return process.env.EXCHANGERATE_HOST_API_KEY?.trim() ?? "";
}

function asError(input: unknown): Error {
  if (input instanceof Error) return input;
  if (typeof input === "string") return new Error(input);
  return new Error("fx_unknown_error");
}

function normalizeRatesPayload(
  payload: Record<string, Record<string, number>> | undefined,
  targetSymbol: string,
): Record<string, Record<string, number>> | null {
  if (!payload || typeof payload !== "object") return null;
  const normalized: Record<string, Record<string, number>> = {};
  const desired = targetSymbol.toUpperCase();
  for (const [dateKey, row] of Object.entries(payload)) {
    if (!row || typeof row !== "object") continue;
    const normalizedRow: Record<string, number> = {};
    for (const [symbol, value] of Object.entries(row)) {
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        continue;
      }
      if (symbol.toUpperCase() !== desired) continue;
      normalizedRow[desired] = value;
    }
    if (Object.keys(normalizedRow).length > 0) {
      normalized[dateKey] = normalizedRow;
    }
  }
  if (Object.keys(normalized).length === 0) return null;
  return normalized;
}

function logFxRequest(provider: string, url: URL) {
  // 输出真实请求地址，便于排查汇率同步问题
  console.info(`[fx.update] ${provider} request -> ${url.toString()}`);
}

async function fetchFrankfurterTimeseries(
  base: string,
  quote: string,
  startDate: Date,
  endDate: Date,
): Promise<FxTimeseriesResponse | null> {
  const fetcher = fxFetchImpl ?? fetch;
  const startIso = formatIsoDate(startDate);
  const endIso = formatIsoDate(endDate);
  const rangeSegment =
    startIso === endIso ? `/${startIso}` : `/${startIso}..${endIso}`;
  const url = new URL(`${FRANKFURTER_BASE_URL}${rangeSegment}`);
  url.searchParams.set("from", base.toUpperCase());
  url.searchParams.set("to", quote.toUpperCase());
  logFxRequest("frankfurter.timeseries", url);
  const res = await fetcher(url.toString(), { method: "GET" });
  if (!res.ok) {
    if (res.status === 422 || res.status === 404) {
      return null;
    }
    throw new Error(`fx_frankfurter_http_${res.status}`);
  }
  const data = (await res.json()) as {
    rates?: Record<string, Record<string, number>>;
  };
  const rates = normalizeRatesPayload(data.rates, quote);
  if (!rates) return null;
  return { rates };
}

async function fetchExchangeRateHostTimeseries(
  base: string,
  quote: string,
  startDate: Date,
  endDate: Date,
): Promise<FxTimeseriesResponse> {
  const apiKey = getExchangerateHostApiKey();
  if (!apiKey) {
    throw new Error("fx_exchangerate_host_api_key_missing");
  }
  const fetcher = fxFetchImpl ?? fetch;
  const url = new URL(`${EXCHANGERATE_HOST_BASE_URL}/timeseries`);
  url.searchParams.set("base", base.toUpperCase());
  url.searchParams.set("symbols", quote.toUpperCase());
  url.searchParams.set("start_date", formatIsoDate(startDate));
  url.searchParams.set("end_date", formatIsoDate(endDate));
  url.searchParams.set("access_key", apiKey);
  logFxRequest("exchangerate_host.timeseries", url);
  const res = await fetcher(url.toString(), { method: "GET" });
  if (!res.ok) {
    throw new Error(`fx_exchangerate_host_http_${res.status}`);
  }
  const data = (await res.json()) as FxTimeseriesResponse & {
    success?: boolean;
    error?: { type?: string; info?: string };
  };
  if (data.success === false) {
    const errorCode = data.error?.type ?? "unknown";
    throw new Error(`fx_exchangerate_host_error_${errorCode}`);
  }
  const rates = normalizeRatesPayload(data.rates, quote);
  if (!rates) {
    throw new Error("fx_exchangerate_host_missing_rates");
  }
  return { rates };
}

async function fetchFrankfurterLatest(
  base: string,
  quote: string,
): Promise<{ rate: number; asOf: Date } | null> {
  const fetcher = fxFetchImpl ?? fetch;
  const url = new URL(`${FRANKFURTER_BASE_URL}/latest`);
  url.searchParams.set("from", base.toUpperCase());
  url.searchParams.set("to", quote.toUpperCase());
  logFxRequest("frankfurter.latest", url);
  const res = await fetcher(url.toString(), { method: "GET" });
  if (!res.ok) {
    if (res.status === 422 || res.status === 404) {
      return null;
    }
    throw new Error(`fx_frankfurter_latest_http_${res.status}`);
  }
  const data = (await res.json()) as {
    rates?: Record<string, number>;
    date?: string;
  };
  const rate = data.rates?.[quote.toUpperCase()];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    return null;
  }
  const asOfRaw = data.date ? new Date(`${data.date}T00:00:00Z`) : new Date();
  return { rate, asOf: normalizeDate(asOfRaw) };
}

async function fetchExchangeRateHostLatest(
  base: string,
  quote: string,
): Promise<{ rate: number; asOf: Date }> {
  const apiKey = getExchangerateHostApiKey();
  if (!apiKey) {
    throw new Error("fx_exchangerate_host_api_key_missing");
  }
  const fetcher = fxFetchImpl ?? fetch;
  const url = new URL(`${EXCHANGERATE_HOST_BASE_URL}/latest`);
  url.searchParams.set("base", base.toUpperCase());
  url.searchParams.set("symbols", quote.toUpperCase());
  url.searchParams.set("access_key", apiKey);
  logFxRequest("exchangerate_host.latest", url);
  const res = await fetcher(url.toString(), { method: "GET" });
  if (!res.ok) {
    throw new Error(`fx_exchangerate_host_latest_http_${res.status}`);
  }
  const data = (await res.json()) as {
    rates?: Record<string, number>;
    date?: string;
    success?: boolean;
    error?: { type?: string; info?: string };
  };
  if (data.success === false) {
    const errorCode = data.error?.type ?? "unknown";
    throw new Error(`fx_exchangerate_host_latest_error_${errorCode}`);
  }
  const rate = data.rates?.[quote.toUpperCase()];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new Error("fx_provider_latest_missing");
  }
  const asOfRaw = data.date ? new Date(`${data.date}T00:00:00Z`) : new Date();
  return { rate, asOf: normalizeDate(asOfRaw) };
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
  let frankfurterError: Error | null = null;
  let frankfurterErrorMessage: string | null = null;
  const primary = await fetchFrankfurterTimeseries(
    base,
    quote,
    startDate,
    endDate,
  ).catch((error) => {
    const normalized = asError(error);
    frankfurterError = normalized;
    frankfurterErrorMessage = normalized.message;
    return null;
  });
  if (primary) {
    return primary;
  }
  try {
    return await fetchExchangeRateHostTimeseries(
      base,
      quote,
      startDate,
      endDate,
    );
  } catch (error) {
    const fallbackError = asError(error);
    if (frankfurterErrorMessage) {
      const aggregate = new Error(
        `fx_timeseries_all_providers_failed:${frankfurterErrorMessage}|${fallbackError.message}`,
      );
      (aggregate as { cause?: unknown }).cause = {
        frankfurter: frankfurterError ?? frankfurterErrorMessage,
        exchangerateHost: fallbackError,
      };
      throw aggregate;
    }
    throw fallbackError;
  }
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
  let frankfurterError: Error | null = null;
  let frankfurterErrorMessage: string | null = null;
  const primary = await fetchFrankfurterLatest(base, quote).catch((error) => {
    const normalized = asError(error);
    frankfurterError = normalized;
    frankfurterErrorMessage = normalized.message;
    return null;
  });
  if (primary) {
    return primary;
  }
  try {
    return await fetchExchangeRateHostLatest(base, quote);
  } catch (error) {
    const fallbackError = asError(error);
    if (frankfurterErrorMessage) {
      const aggregate = new Error(
        `fx_latest_all_providers_failed:${frankfurterErrorMessage}|${fallbackError.message}`,
      );
      (aggregate as { cause?: unknown }).cause = {
        frankfurter: frankfurterError ?? frankfurterErrorMessage,
        exchangerateHost: fallbackError,
      };
      throw aggregate;
    }
    throw fallbackError;
  }
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
  clearFxCache();
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

export type ManualFxTaskExecutionResult =
  | { status: "completed"; inserted: number }
  | { status: "already_running" }
  | { status: "already_completed"; processedAt: Date | null }
  | { status: "conflict" }
  | { status: "failed"; error: string }
  | { status: "not_found" };

export async function executeFxRateUpdateTaskNow(
  taskId: string,
  options: { triggeredBy?: string | null } = {},
): Promise<ManualFxTaskExecutionResult> {
  const task = await prisma.fxRateUpdateTask.findUnique({
    where: { id: taskId },
  });
  if (!task) {
    return { status: "not_found" };
  }
  if (task.status === "RUNNING") {
    return { status: "already_running" };
  }
  if (task.status === "COMPLETED") {
    return {
      status: "already_completed",
      processedAt: task.processedAt ?? null,
    };
  }

  const now = new Date();
  const resetResult = await prisma.fxRateUpdateTask.updateMany({
    where: {
      id: taskId,
      status: { in: ["PENDING", "FAILED"] },
    },
    data: {
      status: "PENDING",
      scheduledFor: now,
      triggeredBy: options.triggeredBy ?? task.triggeredBy,
      lastError: null,
      updatedAt: now,
    },
  });
  if (!resetResult.count) {
    const current = await prisma.fxRateUpdateTask.findUnique({
      where: { id: taskId },
    });
    if (!current) {
      return { status: "not_found" };
    }
    if (current.status === "RUNNING") {
      return { status: "already_running" };
    }
    if (current.status === "COMPLETED") {
      return {
        status: "already_completed",
        processedAt: current.processedAt ?? null,
      };
    }
    return { status: "conflict" };
  }

  const refreshed = await prisma.fxRateUpdateTask.findUnique({
    where: { id: taskId },
  });
  if (!refreshed) {
    return { status: "not_found" };
  }

  const claimed = await markFxRateUpdateRunning(refreshed);
  if (!claimed) {
    return { status: "conflict" };
  }

  await logAudit("FX_RATE_UPDATE_TASK_TRIGGERED_MANUAL", {
    userId: options.triggeredBy ?? null,
    meta: {
      taskId,
      quote: refreshed.quote,
      startDate: refreshed.startDate.toISOString(),
      endDate: refreshed.endDate.toISOString(),
    },
  });

  try {
    const inserted = await runFxRateUpdateTask(refreshed);
    await markFxRateUpdateCompleted(taskId, inserted);
    return { status: "completed", inserted };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "fx_update_unknown_error";
    await markFxRateUpdateFailed(refreshed, message);
    return { status: "failed", error: message };
  } finally {
    clearFxCache();
  }
}

export function resetFxUpdateServiceState() {
  lastCoverageCheck = 0;
  fxFetchImpl = null;
}
