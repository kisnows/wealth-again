import type { Prisma } from "@prisma/client";
import prisma from "@/server/db";

const BASE_CURRENCY = "USD";

const accountInclude = {
  txnLines: true,
  valuations: { orderBy: { asOf: "desc" as const }, take: 1 },
} satisfies Prisma.AccountInclude;

type AccountWithRelations = Prisma.AccountGetPayload<{
  include: typeof accountInclude;
}>;

type LatestFxRate = {
  rate: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

function buildFxRateMap(
  rows: Array<{
    quote: string;
    rate: Prisma.Decimal;
    effectiveFrom: Date;
    effectiveTo: Date | null;
  }>,
) {
  const map = new Map<string, LatestFxRate>();
  rows.forEach((row) => {
    const quote = row.quote.toUpperCase();
    if (!map.has(quote)) {
      map.set(quote, {
        rate: Number(row.rate),
        effectiveFrom: row.effectiveFrom,
        effectiveTo: row.effectiveTo ?? null,
      });
    }
  });
  return map;
}

function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rateMap: Map<string, LatestFxRate>,
): number | null {
  if (!Number.isFinite(amount)) return null;
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  if (from === to) return amount;
  const usdToFrom = from === BASE_CURRENCY ? 1 : rateMap.get(from)?.rate;
  const usdToTo = to === BASE_CURRENCY ? 1 : rateMap.get(to)?.rate;
  if (!usdToFrom || !usdToTo) return null;
  const amountInUsd = amount / usdToFrom;
  return amountInUsd * usdToTo;
}

function computeAccountMetrics(account: AccountWithRelations) {
  const initialBalance = Number(account.initialBalance ?? 0);
  const principal = account.txnLines.reduce((sum, line) => {
    const candidate = (
      line as unknown as { principalDelta?: Prisma.Decimal | number }
    ).principalDelta;
    const delta =
      candidate != null && Number(candidate) !== 0
        ? Number(candidate)
        : Number(line.amount);
    return sum + delta;
  }, initialBalance);
  const latestSnapshot = account.valuations[0] ?? null;
  const valuationCurrency =
    account.accountType === "SAVINGS"
      ? account.baseCurrency
      : (latestSnapshot?.currency ?? account.baseCurrency);
  const valuationBase =
    account.accountType === "SAVINGS"
      ? principal
      : Number(latestSnapshot?.totalValue ?? principal);
  const profit = valuationBase - principal;
  const roi = principal === 0 ? null : profit / principal;
  const latestValuationAt =
    account.accountType === "SAVINGS"
      ? null
      : latestSnapshot?.asOf
        ? latestSnapshot.asOf.toISOString()
        : null;
  return {
    id: account.id,
    name: account.name,
    accountType: account.accountType,
    status: account.status,
    subType: account.subType,
    description: account.description,
    currency: account.baseCurrency,
    initialBalance,
    principal,
    valuation: valuationBase,
    profit,
    roi,
    valuationCurrency,
    latestValuationAt,
  };
}

export type AccountSummaryItem = ReturnType<typeof computeAccountMetrics> & {
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

export type AccountsSummaryResult = {
  items: AccountSummaryItem[];
  displayCurrency: string | null;
  totals: AccountsSummaryTotals;
};

function gatherCurrencyCodes(
  accounts: AccountWithRelations[],
  displayCurrency?: string | null,
) {
  const codes = new Set<string>();
  accounts.forEach((account) => {
    if (account.baseCurrency) codes.add(account.baseCurrency.toUpperCase());
    if (account.accountType !== "SAVINGS") {
      const snapshotCurrency = account.valuations[0]?.currency;
      if (snapshotCurrency) codes.add(snapshotCurrency.toUpperCase());
    }
  });
  if (displayCurrency) codes.add(displayCurrency.toUpperCase());
  codes.delete(BASE_CURRENCY);
  return Array.from(codes);
}

type SummaryQueryOptions = {
  userId?: string;
  accountIds?: string[];
  displayCurrency?: string | null;
};

export async function computeAccountsSummary(options: SummaryQueryOptions) {
  const where: Prisma.AccountWhereInput = {};
  if (options.userId) where.userId = options.userId;
  if (options.accountIds?.length) {
    where.id =
      options.accountIds.length === 1
        ? options.accountIds[0]
        : { in: options.accountIds };
  }
  const accounts = await prisma.account.findMany({
    where,
    include: accountInclude,
    orderBy: { createdAt: "asc" },
  });
  if (accounts.length === 0) {
    return {
      items: [],
      displayCurrency: options.displayCurrency ?? null,
      totals: { assets: 0, liabilities: 0, netWorth: 0, archived: 0 },
    };
  }

  const displayCurrencyUpper = options.displayCurrency
    ? options.displayCurrency.toUpperCase()
    : null;

  const codesToFetch = gatherCurrencyCodes(accounts, displayCurrencyUpper);
  const now = new Date();
  const fxRateClient = prisma.fxRate as unknown as {
    findMany: (args: {
      where: {
        base: string;
        quote: { in: string[] };
        effectiveFrom: { lte: Date };
        OR: Array<{ effectiveTo: null } | { effectiveTo: { gt: Date } }>;
      };
      orderBy: { effectiveFrom: "desc" };
    }) => Promise<
      Array<{
        quote: string;
        rate: Prisma.Decimal;
        effectiveFrom: Date;
        effectiveTo: Date | null;
      }>
    >;
  };
  const rawFxRows =
    codesToFetch.length === 0
      ? []
      : await fxRateClient.findMany({
          where: {
            base: BASE_CURRENCY,
            quote: { in: codesToFetch },
            effectiveFrom: { lte: now },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
          },
          orderBy: { effectiveFrom: "desc" },
        });
  const rateMap = buildFxRateMap(
    rawFxRows as Array<{
      quote: string;
      rate: Prisma.Decimal;
      effectiveFrom: Date;
      effectiveTo: Date | null;
    }>,
  );

  const items: AccountSummaryItem[] = accounts.map((account) => {
    const metrics = computeAccountMetrics(account);
    if (!displayCurrencyUpper) {
      return metrics;
    }
    const displayValue = convertAmount(
      metrics.valuation,
      metrics.valuationCurrency ?? metrics.currency,
      displayCurrencyUpper,
      rateMap,
    );
    const displayPrincipal = convertAmount(
      metrics.principal,
      metrics.currency,
      displayCurrencyUpper,
      rateMap,
    );
    const displayInitial = convertAmount(
      metrics.initialBalance,
      metrics.currency,
      displayCurrencyUpper,
      rateMap,
    );
    const displayProfit =
      displayValue != null && displayPrincipal != null
        ? displayValue - displayPrincipal
        : null;
    return {
      ...metrics,
      displayValue: displayValue ?? undefined,
      displayPrincipal: displayPrincipal ?? undefined,
      displayProfit: displayProfit ?? undefined,
      displayInitialBalance: displayInitial ?? undefined,
    };
  });

  const totals = items.reduce<AccountsSummaryTotals>(
    (acc, item) => {
      const valuationForTotals =
        displayCurrencyUpper && typeof item.displayValue === "number"
          ? item.displayValue
          : item.valuation;
      if ((item.status ?? "ACTIVE") === "ARCHIVED") {
        acc.archived += valuationForTotals;
      }
      if (item.accountType === "LOAN") {
        acc.liabilities += valuationForTotals;
      } else {
        acc.assets += valuationForTotals;
      }
      return acc;
    },
    { assets: 0, liabilities: 0, netWorth: 0, archived: 0 },
  );
  totals.netWorth = totals.assets - totals.liabilities;

  return {
    items,
    displayCurrency: displayCurrencyUpper,
    totals,
  };
}

export async function computeAccountSummaryById(options: {
  accountId: string;
  userId?: string;
  displayCurrency?: string | null;
}) {
  const result = await computeAccountsSummary({
    accountIds: [options.accountId],
    userId: options.userId,
    displayCurrency: options.displayCurrency ?? null,
  });
  return result.items[0] ?? null;
}
