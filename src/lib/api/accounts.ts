"use client";

import useSWR, { mutate as globalMutate } from "swr";
import { deleteJson, getJson, patchJson, postJson } from "@/lib/utils/fetcher";

export type Account = {
  id: string;
  userId: string;
  name: string;
  accountType: "SAVINGS" | "INVESTMENT" | "LOAN" | "OTHER";
  baseCurrency: string;
  subType?: string | null;
  description?: string | null;
  status?: "ACTIVE" | "ARCHIVED";
  initialBalance?: number;
};

const ACCOUNTS_KEY = "/api/v1/accounts-ledger/accounts";
const ACCOUNTS_SUMMARY_PREFIX = "/api/v1/reporting/accounts/summary";
const accountTransactionsKey = (id: string) =>
  `/api/v1/accounts-ledger/accounts/${id}/transactions`;

export function useAccounts() {
  const swr = useSWR<Account[]>(ACCOUNTS_KEY, getJson);
  return { ...swr, refresh: () => globalMutate(ACCOUNTS_KEY) };
}

function revalidateAccountSummaries() {
  return globalMutate((key) => {
    if (typeof key !== "string") return false;
    return key.startsWith(ACCOUNTS_SUMMARY_PREFIX);
  });
}

function revalidateAccountTransactions(ids: string | string[]) {
  const list = Array.isArray(ids) ? ids : [ids];
  return Promise.all(
    list.map((id) => globalMutate(accountTransactionsKey(id))),
  );
}

async function revalidateAccountsData(options?: { skipList?: boolean }) {
  const tasks: Array<Promise<unknown>> = [];
  if (!options?.skipList) {
    tasks.push(globalMutate(ACCOUNTS_KEY));
  }
  tasks.push(revalidateAccountSummaries());
  await Promise.all(tasks);
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
  const key = id
    ? `/api/v1/accounts-ledger/accounts/${id}/summary`
    : null;
  return useSWR<AccountSummary>(key, getJson);
}

export type AccountTransaction = {
  id: string;
  entryId: string;
  type: string;
  occurredAt: string;
  createdAt: string;
  amount: number;
  currency: string;
  note: string | null;
  entryNote: string | null;
  lineNote: string | null;
  direction: "INFLOW" | "OUTFLOW";
  counterpartyAccountId: string | null;
  counterpartyName: string | null;
  counterpartyCurrency: string | null;
  exchangeRateAB: number | null;
  viaCurrency: string | null;
  rateAtoUSD: number | null;
  rateUSDtoB: number | null;
  fxEffectiveAt: string | null;
  principalDelta: number;
  valuationDelta: number;
  attachmentUrl: string | null;
};

export function useAccountTransactions(id: string | null | undefined) {
  const key = id ? accountTransactionsKey(id) : null;
  const swr = useSWR<{ items: AccountTransaction[] }>(key, getJson);
  return {
    ...swr,
    data: swr.data?.items ?? [],
    refresh: () => (key ? globalMutate(key) : Promise.resolve()),
  };
}

export function useAccountTimeseries(
  id: string | undefined,
  metric: "valuation" | "principal" = "valuation",
  from?: string,
  to?: string,
) {
  const params = new URLSearchParams({ metric });
  if (from) params.set("from", from);
  if (to) params.set("to", to ?? "");
  const key = id
    ? `/api/v1/accounts-ledger/accounts/${id}/timeseries?${params.toString()}`
    : null;
  return useSWR<{ points: Array<{ asOf: string; value: number }> }>(
    key,
    getJson,
  );
}

export async function createAccount(input: Omit<Account, "id" | "userId">) {
  const created = await postJson<Account>(
    "/api/v1/accounts-ledger/accounts",
    input,
  );
  await revalidateAccountsData();
  return created;
}

export async function updateAccount(
  id: string,
  patch: Partial<Pick<Account, "name" | "subType" | "description" | "status">>,
) {
  const updated = await patchJson<Account>(
    `/api/v1/accounts-ledger/accounts/${id}`,
    patch,
  );
  await revalidateAccountsData();
  return updated;
}

export async function archiveAccount(id: string) {
  const res = await postJson(
    `/api/v1/accounts-ledger/accounts/${id}/archive`,
    {},
  );
  await revalidateAccountsData();
  return res;
}

export async function deleteAccount(id: string) {
  const res = await deleteJson<{ id: string }>(
    `/api/v1/accounts-ledger/accounts/${id}`,
  );
  await revalidateAccountsData();
  return res;
}

export async function postDeposit(input: {
  accountId: string;
  amount: number;
  occurredAt: string;
  note?: string;
  attachmentUrl?: string;
}) {
  const res = await postJson(
    "/api/v1/accounts-ledger/entries/deposit",
    input,
  );
  await revalidateAccountsData({ skipList: true });
  await revalidateAccountTransactions(input.accountId);
  return res;
}

export async function postWithdraw(input: {
  accountId: string;
  amount: number;
  occurredAt: string;
  note?: string;
  attachmentUrl?: string;
}) {
  const res = await postJson(
    "/api/v1/accounts-ledger/entries/withdraw",
    input,
  );
  await revalidateAccountsData({ skipList: true });
  await revalidateAccountTransactions(input.accountId);
  return res;
}

export async function postTransfer(input: {
  from: { accountId: string; amount: number };
  to: { accountId: string; amount?: number };
  occurredAt: string;
  note?: string;
  asOf?: string;
  attachmentUrl?: string;
}) {
  const res = await postJson(
    "/api/v1/accounts-ledger/entries/transfer",
    input,
  );
  await revalidateAccountsData({ skipList: true });
  await revalidateAccountTransactions([
    input.from.accountId,
    input.to.accountId,
  ]);
  return res;
}

export async function postValuation(input: {
  accountId: string;
  asOf: string;
  totalValue: number;
  currency?: string;
  fxRateId?: string;
  note?: string;
}) {
  const res = await postJson(
    "/api/v1/accounts-ledger/valuations",
    input,
  );
  await revalidateAccountsData({ skipList: true });
  return res;
}
