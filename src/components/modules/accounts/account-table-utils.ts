"use client";

import type { Account } from "@/lib/api/accounts";
import type { AccountSummaryItem } from "@/lib/api/reports";

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  SAVINGS: "储蓄",
  INVESTMENT: "投资",
  LOAN: "借贷",
  OTHER: "其他",
};

export const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "在用",
  ARCHIVED: "已归档",
};

export type NormalizedMetrics = AccountSummaryItem & {
  principal: number;
  valuation: number;
  profit: number;
  displayValue?: number;
  displayPrincipal?: number;
  displayProfit?: number;
  displayInitialBalance?: number;
  initialBalance: number;
};

export type EnrichedAccount = Account & {
  metrics: NormalizedMetrics;
};

export function normalizeAccountData(
  accounts: Account[],
  summaries: AccountSummaryItem[],
): EnrichedAccount[] {
  const summaryMap = new Map<string, AccountSummaryItem>();
  summaries.forEach((summary) => {
    summaryMap.set(summary.id, summary);
  });
  const merged = accounts.map((account) => {
    const summary = summaryMap.get(account.id);
    const baseMetrics: NormalizedMetrics = summary
      ? {
          ...summary,
          principal: Number(summary.principal ?? 0),
          valuation: Number(summary.valuation ?? 0),
          profit: Number(summary.profit ?? 0),
          displayValue:
            typeof summary.displayValue === "number"
              ? Number(summary.displayValue)
              : undefined,
          displayPrincipal:
            typeof summary.displayPrincipal === "number"
              ? Number(summary.displayPrincipal)
              : undefined,
          displayProfit:
            typeof summary.displayProfit === "number"
              ? Number(summary.displayProfit)
              : undefined,
          displayInitialBalance:
            typeof summary.displayInitialBalance === "number"
              ? Number(summary.displayInitialBalance)
              : undefined,
          initialBalance: Number(summary.initialBalance ?? 0),
        }
      : {
          id: account.id,
          name: account.name,
          accountType: account.accountType,
          status: account.status ?? "ACTIVE",
          subType: account.subType,
          description: account.description,
          currency: account.baseCurrency,
          initialBalance: Number(account.initialBalance ?? 0),
          principal: Number(account.initialBalance ?? 0),
          valuation: Number(account.initialBalance ?? 0),
          profit: 0,
          roi: null,
          latestValuationAt: null,
          valuationCurrency: account.baseCurrency,
          displayValue: undefined,
          displayPrincipal: undefined,
          displayProfit: undefined,
          displayInitialBalance: undefined,
        };
    const resolvedStatus =
      account.status ??
      (baseMetrics.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE");
    const resolvedAccountType = (
      ["SAVINGS", "INVESTMENT", "LOAN", "OTHER"] as const
    ).includes(
      (baseMetrics.accountType as Account["accountType"]) ??
        account.accountType,
    )
      ? ((baseMetrics.accountType ??
          account.accountType) as Account["accountType"])
      : account.accountType;
    baseMetrics.accountType = resolvedAccountType;
    baseMetrics.status = resolvedStatus;
    return {
      ...account,
      status: resolvedStatus,
      accountType: resolvedAccountType,
      metrics: baseMetrics,
    };
  });

  summaries.forEach((summary) => {
    const exists = merged.some((account) => account.id === summary.id);
    if (!exists) {
      const fallbackStatus =
        summary.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE";
      const fallbackAccountType = (
        ["SAVINGS", "INVESTMENT", "LOAN", "OTHER"] as const
      ).includes(summary.accountType as Account["accountType"])
        ? (summary.accountType as Account["accountType"])
        : "INVESTMENT";
      merged.push({
        id: summary.id,
        userId: "",
        name: summary.name,
        accountType: fallbackAccountType,
        baseCurrency: summary.currency,
        subType: summary.subType ?? null,
        description: summary.description ?? null,
        status: fallbackStatus,
        initialBalance: summary.initialBalance,
        metrics: {
          ...summary,
          status: fallbackStatus,
          accountType: fallbackAccountType,
          principal: Number(summary.principal ?? 0),
          valuation: Number(summary.valuation ?? 0),
          profit: Number(summary.profit ?? 0),
          displayValue:
            typeof summary.displayValue === "number"
              ? Number(summary.displayValue)
              : undefined,
          displayPrincipal:
            typeof summary.displayPrincipal === "number"
              ? Number(summary.displayPrincipal)
              : undefined,
          displayProfit:
            typeof summary.displayProfit === "number"
              ? Number(summary.displayProfit)
              : undefined,
          displayInitialBalance:
            typeof summary.displayInitialBalance === "number"
              ? Number(summary.displayInitialBalance)
              : undefined,
          initialBalance: Number(summary.initialBalance ?? 0),
        },
      } as EnrichedAccount);
    }
  });

  return merged;
}

export function shouldShowValuation(accountType: string) {
  return ["INVESTMENT", "LOAN"].includes(accountType);
}
