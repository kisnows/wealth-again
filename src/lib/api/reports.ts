"use client";

import useSWR from "swr";
import type { IncomeRecordsSummary } from "@/lib/api/income";
import { getJson } from "@/lib/utils/fetcher";

export type AccountSummaryItem = {
  id: string;
  name: string;
  accountType: "SAVINGS" | "INVESTMENT" | "LOAN" | "OTHER" | string;
  status: "ACTIVE" | "ARCHIVED" | string | null;
  subType?: string | null;
  description?: string | null;
  currency: string;
  initialBalance: number;
  principal: number;
  valuation: number;
  profit: number;
  roi: number | null;
  latestValuationAt: string | null;
  valuationCurrency: string;
  displayValue?: number;
};

export type AccountsSummaryResponse = {
  items: AccountSummaryItem[];
  displayCurrency: string | null;
};

export function useDashboard(asOf?: string, displayCurrency?: string) {
  const params = new URLSearchParams();
  if (asOf) params.set("asOf", asOf);
  if (displayCurrency) params.set("displayCurrency", displayCurrency);
  const key = `/api/v1/reports/dashboard${params.toString() ? `?${params}` : ""}`;
  return useSWR<any>(key, getJson);
}

export function useAccountsSummary(displayCurrency?: string) {
  const key = `/api/v1/reports/accounts/summary${displayCurrency ? `?displayCurrency=${displayCurrency}` : ""}`;
  return useSWR<AccountsSummaryResponse>(key, getJson);
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
  return useSWR<{
    series: Record<string, Array<{ month: string; value: number }>>;
    summary: IncomeRecordsSummary;
  }>(key, getJson);
}
