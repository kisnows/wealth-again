"use client";

import useSWR, { mutate as globalMutate } from "swr";
import { getJson, patchJson, postJson } from "@/lib/utils/fetcher";

export type Account = {
  id: string;
  userId: string;
  name: string;
  accountType: "SAVINGS" | "INVESTMENT" | "LOAN";
  baseCurrency: string;
  subType?: string | null;
  description?: string | null;
  status?: "ACTIVE" | "ARCHIVED";
  initialBalance?: number;
};

export function useAccounts() {
  const key = "/api/v1/accounts";
  const swr = useSWR<Account[]>(key, getJson);
  return { ...swr, refresh: () => globalMutate(key) };
}

export type AccountSummary = {
  id: string;
  name: string;
  currency: string;
  principal: number;
  valuation: number;
  profit: number;
  roi: number | null;
  displayValue?: number;
};

export function useAccountSummary(id: string) {
  const key = id ? `/api/v1/accounts/${id}/summary` : null;
  return useSWR<AccountSummary>(key, getJson);
}

export function useAccountTimeseries(
  id: string | undefined,
  metric: "valuation" | "principal" = "valuation",
  from?: string,
  to?: string
) {
  if (!id)
    return { data: undefined, error: undefined, isLoading: false } as const;
  const params = new URLSearchParams({ metric });
  if (from) params.set("from", from);
  if (to) params.set("to", to ?? "");
  const key = `/api/v1/accounts/${id}/timeseries?${params.toString()}`;
  return useSWR<{ points: Array<{ asOf: string; value: number }> }>(
    key,
    getJson
  );
}

export async function createAccount(input: Omit<Account, "id" | "userId">) {
  const created = await postJson<Account>("/api/v1/accounts", input);
  await globalMutate("/api/v1/accounts");
  return created;
}

export async function updateAccount(
  id: string,
  patch: Partial<Pick<Account, "name" | "subType" | "description" | "status">>
) {
  return patchJson<Account>(`/api/v1/accounts/${id}`, patch);
}

export async function archiveAccount(id: string) {
  const res = await postJson(`/api/v1/accounts/${id}/archive`, {});
  await globalMutate("/api/v1/accounts");
  return res;
}

export async function postDeposit(input: {
  accountId: string;
  amount: number;
  occurredAt: string;
  note?: string;
}) {
  return postJson("/api/v1/entries/deposit", input);
}

export async function postWithdraw(input: {
  accountId: string;
  amount: number;
  occurredAt: string;
  note?: string;
}) {
  return postJson("/api/v1/entries/withdraw", input);
}

export async function postTransfer(input: {
  from: { accountId: string; amount: number };
  to: { accountId: string; amount?: number };
  occurredAt: string;
  note?: string;
  asOf?: string;
}) {
  return postJson("/api/v1/entries/transfer", input);
}

export async function postValuation(input: {
  accountId: string;
  asOf: string;
  totalValue: number;
  currency?: string;
  fxRateId?: string;
  note?: string;
}) {
  return postJson("/api/v1/valuations", input);
}
