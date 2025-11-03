import { computeAccountsSummary } from "@/server/services/accounts-ledger/accounts";

type MonthPoint = {
  month: string;
  netWorth: number;
  assets: number;
  liabilities: number;
};

function startOfMonth(date: Date): Date {
  const normalized = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  return normalized;
}

function endOfMonth(date: Date): Date {
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return end;
}

function addMonths(date: Date, delta: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
}

export async function buildNetWorthTrend({
  userId,
  displayCurrency,
  asOf,
  months = 12,
}: {
  userId: string;
  displayCurrency?: string | null;
  asOf?: Date | null;
  months?: number;
}): Promise<MonthPoint[]> {
  const targetAsOf = asOf ? new Date(asOf) : new Date();
  const monthAnchor = startOfMonth(targetAsOf);
  const monthStarts = Array.from({ length: Math.max(1, months) }, (_v, index) =>
    addMonths(monthAnchor, index - (months - 1)),
  );
  const summaries = await Promise.all(
    monthStarts.map((monthStart) =>
      computeAccountsSummary({
        userId,
        displayCurrency: displayCurrency ?? null,
        asOf: endOfMonth(monthStart),
      }),
    ),
  );
  return summaries.map((summary, index) => {
    const monthStart = monthStarts[index]!;
    return {
      month: monthStart.toISOString().slice(0, 10),
      netWorth: Number(summary.totals.netWorth ?? 0),
      assets: Number(summary.totals.assets ?? 0),
      liabilities: Number(summary.totals.liabilities ?? 0),
    };
  });
}
