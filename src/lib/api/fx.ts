"use client";

import useSWR from "swr";
import { getJson, postJson } from "@/lib/utils/fetcher";

export async function getFxRate(base: string, quote: string, on?: string) {
  const p = new URLSearchParams({ base, quote });
  if (on) p.set("on", on);
  return getJson(`/api/v1/fx/rates?${p.toString()}`);
}

export async function createFxRate(input: {
  base: string;
  quote: string;
  rate: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
}) {
  return postJson("/api/v1/fx/rates", input);
}

export async function createFxRateUpdateTask(input: {
  quote: string;
  startDate: string;
  endDate: string;
}) {
  return postJson("/api/v1/fx/rates/tasks", input);
}

export type LatestFxRate = {
  quote: string;
  rate: number | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
};

export type FxRateUpdateTask = {
  id: string;
  base: string;
  quote: string;
  startDate: string;
  endDate: string;
  status: string;
  scheduledFor: string;
  processedAt: string | null;
  attempts: number;
  lastError: string | null;
  triggeredBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FxRateUpdateLog = {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: string;
  rate: number | null;
  attempts: number;
  lastError: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FxRateTaskDetail = FxRateUpdateTask & {
  logs: FxRateUpdateLog[];
  summary: {
    total: number;
    completed: number;
    running: number;
    failed: number;
    skipped: number;
    pending: number;
  };
};

export async function refreshFxRateNow(quote: string) {
  return postJson("/api/v1/fx/rates/refresh", { quote });
}

export function useLatestFxRates(quotes: string[]) {
  const normalized = Array.from(
    new Set(
      quotes
        .map((quote) => quote.toUpperCase())
        .filter((quote) => quote.length > 0),
    ),
  );
  const key =
    normalized.length > 0
      ? `/api/v1/fx/rates/latest?quotes=${normalized.join(",")}`
      : null;
  return useSWR<{ base: string; items: LatestFxRate[] }>(key, getJson);
}

export function useFxRateUpdateTasks(limit = 50) {
  const key = `/api/v1/fx/rates/tasks?limit=${limit}`;
  return useSWR<{ items: FxRateUpdateTask[] }>(key, getJson, {
    refreshInterval: 60_000,
  });
}

export function useFxRateTaskDetails(taskId?: string | null) {
  return useSWR<FxRateTaskDetail>(
    taskId ? `/api/v1/fx/rates/tasks/${taskId}` : null,
    getJson,
    {
      refreshInterval: 15_000,
    },
  );
}
