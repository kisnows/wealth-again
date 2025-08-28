"use client";

import useSWR from "swr";
import { getJson } from "@/lib/utils/fetcher";

export function useDashboard(asOf?: string, displayCurrency?: string) {
  const params = new URLSearchParams();
  if (asOf) params.set("asOf", asOf);
  if (displayCurrency) params.set("displayCurrency", displayCurrency);
  const key = `/api/v1/reports/dashboard${params.toString() ? `?${params}` : ""}`;
  return useSWR<any>(key, getJson);
}

export function useAccountsSummary(displayCurrency?: string) {
  const key = `/api/v1/reports/accounts/summary${displayCurrency ? `?displayCurrency=${displayCurrency}` : ""}`;
  return useSWR<{ items: any[]; displayCurrency: string | null }>(key, getJson);
}

export function useIncomeTimeseries(
  userId: string | undefined,
  from: string,
  to: string,
) {
  const key =
    from && to
      ? `/api/v1/reports/income/timeseries?from=${from}&to=${to}${userId ? `&userId=${userId}` : ""}`
      : null;
  return useSWR<any>(key, getJson);
}
