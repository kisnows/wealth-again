import { computeAccountsSummary } from "@/server/services/accounts-ledger/accounts";

export async function getDashboard(displayCurrency?: string, userId?: string) {
  const summary = await computeAccountsSummary({
    userId,
    displayCurrency,
  });
  return {
    totals: summary.totals,
    allocations: [],
    netWorthTrend: [],
  } as const;
}
