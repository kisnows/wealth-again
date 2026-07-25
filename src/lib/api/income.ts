"use client";

import type { IncomeRecord } from "@/server/db/types";
import useSWR, { mutate as globalMutate } from "swr";
import { getJson, patchJson, postJson } from "@/lib/utils/fetcher";

export type SalaryChange = {
  id: string;
  userId: string;
  grossMonthly: number;
  currency: string;
  effectiveFrom: string;
};
export type BonusPlan = {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  effectiveDate: string;
  taxMethod?: string;
};
export type LongTermCashPlan = {
  id: string;
  userId: string;
  totalAmount: number;
  currency: string;
  startDate: string;
  periods: number;
  recurrence: string;
};
export type EquityGrant = {
  id: string;
  userId: string;
  totalUnits: number;
  currency: string;
  startVestDate: string;
  vestPeriods: number;
  vestInterval: string;
};
export type EquityVest = {
  id: string;
  grantId: string;
  vestDate: string;
  units: number;
  fairValue?: number | null;
  currency?: string | null;
};

export type IncomeRecordsSummary = {
  months: number;
  currency: string | null;
  totalGross: number;
  totalBonus: number;
  totalLtc: number;
  totalEquity: number;
  totalSocialInsurance: number;
  totalHousingFund: number;
  totalSpecialDeductions: number;
  totalTax: number;
  totalNet: number;
  totalIncome: number;
  avgTaxRate: number;
  latestTaxPaid?: number;
  latestTaxCumulative?: number;
};

export type IncomeTimelineItem = {
  recordId: string | null;
  monthDate: string;
  month: string;
  currency: string;
  recordCurrency: string;
  sourceCurrency?: string | null;
  displayCurrency: string;
  displayRate: number;
  fxSnapshotId: string | null;
  fxSnapshotCapturedAt: string | null;
  fxAppliedRate: number;
  cityId: string | null;
  gross: number;
  bonus: number;
  ltcIncome: number;
  equityIncome: number;
  socialInsurance: number;
  housingFund: number;
  specialDeductions: number;
  taxableCurrent: number;
  taxableCumulative: number;
  taxCumulative: number;
  taxPaidCumulative: number;
  incomeTax: number;
  netIncome: number;
  source: "system" | "manual" | "forecast";
  isForecast: boolean;
  manualNet: number | null;
  manualNote: string | null;
};

export type IncomeTimelineTotals = {
  gross: number;
  bonus: number;
  ltcIncome: number;
  equityIncome: number;
  socialInsurance: number;
  housingFund: number;
  incomeTax: number;
  netIncome: number;
};

export type IncomeTimelineSummary = {
  currency: string;
  counts: {
    total: number;
    actual: number;
    forecast: number;
  };
  totals: {
    actual: IncomeTimelineTotals;
    forecast: IncomeTimelineTotals;
    combined: IncomeTimelineTotals;
  };
};

export type IncomeTimelineResponse = {
  items: IncomeTimelineItem[];
  summary: IncomeTimelineSummary;
  meta: {
    range: {
      from: string;
      to: string;
    };
  };
};

export type AnnualDeduction = {
  id: string;
  userId: string;
  taxYear: number;
  annualAmount: number;
  allocationRule?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IncomeRecalcTask = {
  id: string;
  userId: string | null;
  taxYear: number;
  startMonth: number;
  endMonth: number;
  cityId: string | null;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  scheduledFor: string;
  attempts: number;
  lastError: string | null;
  triggeredBy: string | null;
  createdAt: string;
  updatedAt: string;
  processedAt: string | null;
};

export const INCOME_RECALC_TASKS_KEY = "/api/v1/income-tax/recalc/tasks";

export function useIncomeRecalcTasks(config?: {
  refreshInterval?: number;
}) {
  return useSWR<{ items: IncomeRecalcTask[] }>(
    INCOME_RECALC_TASKS_KEY,
    getJson,
    config,
  );
}

export function useIncomeRecords(
  userId: string | undefined,
  from: string,
  to: string,
) {
  const key =
    from && to
      ? `/api/v1/income-tax/records?from=${from}&to=${to}${
          userId ? `&userId=${userId}` : ""
        }`
      : null;
  return useSWR<{
    items: IncomeRecord[];
    summary: IncomeRecordsSummary;
  }>(key, getJson);
}

export function useIncomeTimeline(
  from: string,
  to: string,
  displayCurrency?: string | null,
) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (displayCurrency) params.set("displayCurrency", displayCurrency);
  const key =
    from && to ? `/api/v1/income-tax/timeline?${params.toString()}` : null;
  return useSWR<IncomeTimelineResponse>(key, getJson);
}

export async function updateIncomeRecord(
  id: string,
  payload: Partial<{
    manualGross: number | null;
    manualTaxable: number | null;
    manualIncomeTax: number | null;
    manualNet: number | null;
    manualNote: string | null;
  }>,
) {
  return patchJson(`/api/v1/income-tax/records/${id}`, payload);
}

export function useSalaryChanges(userId?: string) {
  const key = `/api/v1/income-tax/salary-changes${
    userId ? `?userId=${userId}` : ""
  }`;
  return useSWR<{ items: SalaryChange[] }>(key, getJson);
}

export async function createSalaryChange(input: {
  userId: string;
  grossMonthly: number;
  currency?: string;
  effectiveFrom: string;
}) {
  const res = await postJson<SalaryChange>(
    "/api/v1/income-tax/salary-changes",
    input,
  );
  await globalMutate(`/api/v1/income-tax/salary-changes?userId=${input.userId}`);
  await globalMutate(INCOME_RECALC_TASKS_KEY);
  return res;
}

export function useBonus(userId?: string) {
  const key = `/api/v1/income-tax/bonus${userId ? `?userId=${userId}` : ""}`;
  return useSWR<{ items: BonusPlan[] }>(key, getJson);
}

export async function createBonus(input: {
  userId: string;
  amount: number;
  currency?: string;
  taxMethod?: string;
  effectiveDate: string;
}) {
  const res = await postJson<BonusPlan>("/api/v1/income-tax/bonus", input);
  await globalMutate(`/api/v1/income-tax/bonus?userId=${input.userId}`);
  await globalMutate(INCOME_RECALC_TASKS_KEY);
  return res;
}

export function useLTCPlans(userId?: string) {
  const key = `/api/v1/income-tax/ltc/plans${userId ? `?userId=${userId}` : ""}`;
  return useSWR<{ items: LongTermCashPlan[] }>(key, getJson);
}

export async function createLTCPlan(input: {
  userId: string;
  totalAmount: number;
  currency?: string;
  startDate: string;
  periods: number;
  recurrence: string;
}) {
  const res = await postJson<LongTermCashPlan>(
    "/api/v1/income-tax/ltc/plans",
    input,
  );
  await globalMutate(`/api/v1/income-tax/ltc/plans?userId=${input.userId}`);
  await globalMutate(INCOME_RECALC_TASKS_KEY);
  return res;
}

export async function generateLTCPayouts(id: string) {
  const res = await postJson(`/api/v1/income-tax/ltc/plans/${id}/generate`, {});
  await globalMutate(INCOME_RECALC_TASKS_KEY);
  return res;
}

export function useEquityGrants(userId?: string) {
  const key = `/api/v1/income-tax/equity/grants${
    userId ? `?userId=${userId}` : ""
  }`;
  return useSWR<{ items: EquityGrant[] }>(key, getJson);
}

export async function createEquityGrant(input: {
  userId: string;
  totalUnits: number;
  currency?: string;
  startVestDate: string;
  vestPeriods: number;
  vestInterval: string;
}) {
  const res = await postJson<EquityGrant>(
    "/api/v1/income-tax/equity/grants",
    input,
  );
  await globalMutate(`/api/v1/income-tax/equity/grants?userId=${input.userId}`);
  await globalMutate(INCOME_RECALC_TASKS_KEY);
  return res;
}

export async function generateEquityVests(id: string) {
  const res = await postJson(`/api/v1/income-tax/equity/grants/${id}/generate`, {});
  await globalMutate(INCOME_RECALC_TASKS_KEY);
  return res;
}

export async function updateEquityVest(
  id: string,
  input: { fairValue: number; currency: string },
) {
  const res = await patchJson(`/api/v1/income-tax/equity/vests/${id}`, input);
  await globalMutate(INCOME_RECALC_TASKS_KEY);
  return res;
}

export async function postIncomeRecalc(input: {
  taxYear: number;
  endMonth: number;
  cityId?: string;
  userId?: string;
  startMonth?: number;
}) {
  const res = await postJson<{ taskId: string; status: string }>(
    "/api/v1/income-tax/recalc",
    input,
  );
  await globalMutate(INCOME_RECALC_TASKS_KEY);
  return res;
}

// 删除工资变更记录
export async function deleteSalaryChange(id: string) {
  const response = await fetch(`/api/v1/income-tax/salary-changes/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`删除工资变更失败: ${response.statusText}`);
  }
  return response.json();
}

// 删除奖金记录
export async function deleteBonus(id: string) {
  const response = await fetch(`/api/v1/income-tax/bonus/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`删除奖金记录失败: ${response.statusText}`);
  }
  return response.json();
}

// 删除长期现金计划
export async function deleteLTCPlan(id: string) {
  const response = await fetch(`/api/v1/income-tax/ltc/plans/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`删除长期现金计划失败: ${response.statusText}`);
  }
  return response.json();
}

export function useAnnualDeductions(userId?: string) {
  const key = userId
    ? `/api/v1/identity/user/annual-deductions?userId=${userId}`
    : "/api/v1/identity/user/annual-deductions";
  return useSWR<{ items: AnnualDeduction[] }>(key, getJson);
}

export async function upsertAnnualDeduction(input: {
  taxYear: number;
  annualAmount: number;
  allocationRule?: string | null;
  note?: string | null;
}) {
  const result = await postJson<AnnualDeduction>(
    "/api/v1/identity/user/annual-deductions",
    input,
  );
  await globalMutate("/api/v1/identity/user/annual-deductions");
  return result;
}

export async function updateAnnualDeduction(
  id: string,
  input: {
    taxYear?: number;
    annualAmount?: number;
    allocationRule?: string | null;
    note?: string | null;
  },
) {
  const result = await patchJson<AnnualDeduction>(
    `/api/v1/identity/user/annual-deductions/${id}`,
    input,
  );
  await globalMutate("/api/v1/identity/user/annual-deductions");
  return result;
}
