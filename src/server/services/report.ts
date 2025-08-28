import { computeAccountSummary } from "@/app/api/v1/reports/accounts/summary/utils";

export async function getDashboard(displayCurrency?: string) {
  const items = await computeAccountSummary(displayCurrency);
  const totals = items.reduce(
    (acc, i) => {
      const v = i.displayValue ?? i.valuation;
      // 简化：全部算入资产
      acc.assets += v;
      return acc;
    },
    { assets: 0, liabilities: 0 },
  );
  const netWorth = totals.assets - totals.liabilities;
  return {
    totals: { ...totals, netWorth },
    allocations: [],
    timeseries: [],
  } as const;
}
