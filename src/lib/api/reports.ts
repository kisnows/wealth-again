"use client";

import useSWR from "swr";
import type { IncomeRecordsSummary } from "@/lib/api/income";
import type {
  DashboardResponse,
  ReportDatasetItem as ReportDatasetItemSchema,
} from "@/types/openapi";
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
  displayPrincipal?: number;
  displayProfit?: number;
  displayInitialBalance?: number;
};

export type AccountsSummaryTotals = {
  assets: number;
  liabilities: number;
  netWorth: number;
  archived: number;
};

export type AccountsSummaryResponse = {
  items: AccountSummaryItem[];
  displayCurrency: string | null;
  totals: AccountsSummaryTotals;
};

export type ReportDatasetItem = ReportDatasetItemSchema;

export function useReportDatasets(scope?: string) {
  const params = new URLSearchParams();
  if (scope) params.set("scope", scope);
  const key = `/api/v1/reporting/datasets${params.toString() ? `?${params.toString()}` : ""}`;
  return useSWR<{ items: ReportDatasetItem[] }>(key, getJson);
}

export function useDashboard(asOf?: string, displayCurrency?: string) {
  const params = new URLSearchParams();
  if (asOf) params.set("asOf", asOf);
  if (displayCurrency) params.set("displayCurrency", displayCurrency);
  const key = `/api/v1/reporting/dashboard${params.toString() ? `?${params}` : ""}`;
  return useSWR<DashboardResponse>(key, getJson);
}

export function useAccountsSummary(displayCurrency?: string) {
  const key = `/api/v1/reporting/accounts/summary${displayCurrency ? `?displayCurrency=${displayCurrency}` : ""}`;
  return useSWR<AccountsSummaryResponse>(key, getJson);
}

export function useIncomeTimeseries(
  userId: string | undefined,
  from: string,
  to: string,
  displayCurrency?: string | null,
) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (userId) params.set("userId", userId);
  if (displayCurrency) params.set("displayCurrency", displayCurrency);
  const key =
    from && to
      ? `/api/v1/reporting/income/timeseries?${params.toString()}`
      : null;
  return useSWR<{
    series: Record<string, Array<{ month: string; value: number }>>;
    summary: IncomeRecordsSummary;
  }>(key, getJson);
}
