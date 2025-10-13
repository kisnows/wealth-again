import { computeAccountsSummary } from "@/server/services/accounts-summary";

export async function getDashboard(displayCurrency?: string, userId?: string) {
  const summary = await computeAccountsSummary({
    userId,
    displayCurrency,
  });
  return {
    totals: summary.totals,
    allocations: [],
    timeseries: [],
  } as const;
}
