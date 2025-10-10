"use client";

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

export function useIncomeRecords(
  userId: string | undefined,
  from: string,
  to: string
) {
  const key =
    from && to
      ? `/api/v1/income/records?from=${from}&to=${to}${
          userId ? `&userId=${userId}` : ""
        }`
      : null;
  return useSWR<{
    items: any[];
    summary: IncomeRecordsSummary;
  }>(key, getJson);
}

export function useSalaryChanges(userId?: string) {
  const key = `/api/v1/income/salary-changes${
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
    "/api/v1/income/salary-changes",
    input
  );
  await globalMutate(`/api/v1/income/salary-changes?userId=${input.userId}`);
  return res;
}

export function useBonus(userId?: string) {
  const key = `/api/v1/income/bonus${userId ? `?userId=${userId}` : ""}`;
  return useSWR<{ items: BonusPlan[] }>(key, getJson);
}

export async function createBonus(input: {
  userId: string;
  amount: number;
  currency?: string;
  taxMethod?: string;
  effectiveDate: string;
}) {
  const res = await postJson<BonusPlan>("/api/v1/income/bonus", input);
  await globalMutate(`/api/v1/income/bonus?userId=${input.userId}`);
  return res;
}

export function useLTCPlans(userId?: string) {
  const key = `/api/v1/income/ltc/plans${userId ? `?userId=${userId}` : ""}`;
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
    "/api/v1/income/ltc/plans",
    input
  );
  await globalMutate(`/api/v1/income/ltc/plans?userId=${input.userId}`);
  return res;
}

export async function generateLTCPayouts(id: string) {
  return postJson(`/api/v1/income/ltc/plans/${id}/generate`, {});
}

export function useEquityGrants(userId?: string) {
  const key = `/api/v1/income/equity/grants${
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
    "/api/v1/income/equity/grants",
    input
  );
  await globalMutate(`/api/v1/income/equity/grants?userId=${input.userId}`);
  return res;
}

export async function generateEquityVests(id: string) {
  return postJson(`/api/v1/income/equity/grants/${id}/generate`, {});
}

export async function updateEquityVest(
  id: string,
  input: { fairValue: number; currency: string }
) {
  return patchJson(`/api/v1/income/equity/vests/${id}`, input);
}

export async function postIncomeRecalc(input: {
  taxYear: number;
  endMonth: number;
  cityId?: string;
  userId?: string;
  startMonth?: number;
}) {
  return postJson("/api/v1/income/recalc", input);
}

// 删除工资变更记录
export async function deleteSalaryChange(id: string) {
  const response = await fetch(`/api/v1/income/salary-changes/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`删除工资变更失败: ${response.statusText}`);
  }
  return response.json();
}

// 删除奖金记录
export async function deleteBonus(id: string) {
  const response = await fetch(`/api/v1/income/bonus/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`删除奖金记录失败: ${response.statusText}`);
  }
  return response.json();
}

// 删除长期现金计划
export async function deleteLTCPlan(id: string) {
  const response = await fetch(`/api/v1/income/ltc/plans/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`删除长期现金计划失败: ${response.statusText}`);
  }
  return response.json();
}

export function useAnnualDeductions(userId?: string) {
  const key = userId
    ? `/api/v1/user/annual-deductions?userId=${userId}`
    : "/api/v1/user/annual-deductions";
  return useSWR<{ items: AnnualDeduction[] }>(key, getJson);
}
