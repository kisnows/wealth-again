import type { Prisma } from "@prisma/client";
import prisma from "@/server/db";
import {
  convert,
  ensureFxSnapshotBatch,
  type FxSnapshotInfo,
} from "@/server/services/fx";

const BASE_CURRENCY = "USD";

const accountInclude = {
  txnLines: {
    select: {
      amount: true,
      principalDelta: true,
    },
  },
  valuations: {
    select: {
      asOf: true,
      totalValue: true,
      currency: true,
      fxSnapshotId: true,
      fxAppliedRate: true,
    },
    orderBy: { asOf: "desc" as const },
    take: 1,
  },
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
    const candidate = (line as { principalDelta?: Prisma.Decimal | number })
      .principalDelta;
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
    valuationSnapshotId: account.valuations[0]?.fxSnapshotId ?? null,
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
  const fxRateDelegate = (prisma as any).fxRate;
  const rawFxRows =
    codesToFetch.length === 0 || typeof fxRateDelegate?.findMany !== "function"
      ? []
      : await fxRateDelegate.findMany({
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

  const valuationSnapshotIds = accounts
    .map((account) => account.valuations[0]?.fxSnapshotId)
    .filter((id): id is string => Boolean(id));
  const rawSnapshotRows =
    valuationSnapshotIds.length === 0
      ? []
      : await prisma.fxSnapshot.findMany({
          where: { id: { in: valuationSnapshotIds } },
          select: {
            id: true,
            baseCurrency: true,
            quoteCurrency: true,
            rate: true,
            capturedAt: true,
          },
        });
  const snapshotMap = new Map<
    string,
    {
      id: string;
      baseCurrency: string;
      quoteCurrency: string;
      rate: number;
      capturedAt: Date;
    }
  >();
  rawSnapshotRows.forEach((row) => {
    snapshotMap.set(row.id, {
      id: row.id,
      baseCurrency: row.baseCurrency,
      quoteCurrency: row.quoteCurrency,
      rate: Number(row.rate),
      capturedAt: row.capturedAt,
    });
  });

  const bridgeRequests: Array<{
    key: string;
    request: { base: string; quote: string; asOf: Date; allowMissing: boolean };
  }> = [];
  if (displayCurrencyUpper) {
    rawSnapshotRows.forEach((snap) => {
      const base = snap.baseCurrency.toUpperCase();
      if (base === displayCurrencyUpper) return;
      const key = buildBridgeKey(base, displayCurrencyUpper, snap.capturedAt);
      if (bridgeRequests.find((item) => item.key === key)) return;
      bridgeRequests.push({
        key,
        request: {
          base,
          quote: displayCurrencyUpper,
          asOf: snap.capturedAt,
          allowMissing: true,
        },
      });
    });
  }
  const ensureBatch =
    typeof ensureFxSnapshotBatch === "function"
      ? ensureFxSnapshotBatch
      : async (requests: Array<Record<string, unknown>>) =>
          requests.map(() => null);
  const bridgeSnapshots = bridgeRequests.length
    ? await ensureBatch(bridgeRequests.map((item) => item.request))
    : [];
  const bridgeMap = new Map<string, FxSnapshotInfo>();
  bridgeSnapshots.forEach((snapshot, index) => {
    if (snapshot) bridgeMap.set(bridgeRequests[index]!.key, snapshot);
  });

  const items: AccountSummaryItem[] = await Promise.all(
    accounts.map(async (account) => {
      const metrics = computeAccountMetrics(account);
      if (!displayCurrencyUpper) {
        return metrics;
      }
      const latestValuation = account.valuations[0] ?? null;
      const valuationSnapshot =
        latestValuation?.fxSnapshotId != null
          ? (snapshotMap.get(latestValuation.fxSnapshotId) ?? null)
          : null;
      const valuationAsOf =
        latestValuation?.asOf ??
        valuationSnapshot?.capturedAt ??
        new Date(account.updatedAt ?? Date.now());
      const displayValue = await convertAmountForDisplay({
        amount: metrics.valuation,
        amountCurrency: metrics.valuationCurrency ?? metrics.currency,
        snapshot: valuationSnapshot,
        displayCurrency: displayCurrencyUpper,
        bridgeMap,
        fallbackAsOf: valuationAsOf,
        rateMap,
      });
      const displayPrincipal = await convertAmountForDisplay({
        amount: metrics.principal,
        amountCurrency: metrics.currency,
        snapshot:
          metrics.valuationCurrency === metrics.currency
            ? valuationSnapshot
            : null,
        displayCurrency: displayCurrencyUpper,
        bridgeMap,
        fallbackAsOf: valuationAsOf,
        rateMap,
      });
      const displayInitial = await convertAmountForDisplay({
        amount: metrics.initialBalance,
        amountCurrency: metrics.currency,
        snapshot: null,
        displayCurrency: displayCurrencyUpper,
        bridgeMap,
        fallbackAsOf: valuationAsOf,
        rateMap,
      });
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
    }),
  );

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

function buildBridgeKey(base: string, target: string, capturedAt: Date) {
  return `${base.toUpperCase()}::${target.toUpperCase()}::${capturedAt.toISOString()}`;
}

async function convertAmountForDisplay({
  amount,
  amountCurrency,
  snapshot,
  displayCurrency,
  bridgeMap,
  fallbackAsOf,
  rateMap,
}: {
  amount: number;
  amountCurrency: string;
  snapshot: {
    baseCurrency: string;
    quoteCurrency: string;
    rate: number;
    capturedAt: Date;
  } | null;
  displayCurrency: string;
  bridgeMap: Map<string, FxSnapshotInfo>;
  fallbackAsOf: Date;
  rateMap: Map<string, LatestFxRate>;
}) {
  if (!Number.isFinite(amount)) return null;
  const normalizedAmountCurrency = amountCurrency.toUpperCase();
  const normalizedDisplay = displayCurrency.toUpperCase();
  if (normalizedAmountCurrency === normalizedDisplay) return amount;

  if (snapshot) {
    const base = snapshot.baseCurrency.toUpperCase();
    const quote = snapshot.quoteCurrency.toUpperCase();
    const rate = snapshot.rate;
    let amountInBase: number | null = null;
    if (normalizedAmountCurrency === base) {
      amountInBase = amount;
    } else if (normalizedAmountCurrency === quote) {
      amountInBase = rate === 0 ? null : amount / rate;
    }
    if (amountInBase != null) {
      if (normalizedDisplay === base) return amountInBase;
      if (normalizedDisplay === quote) return amountInBase * rate;
      const bridgeKey = buildBridgeKey(
        base,
        normalizedDisplay,
        snapshot.capturedAt,
      );
      const bridgeSnapshot = bridgeMap.get(bridgeKey);
      if (bridgeSnapshot) {
        return amountInBase * bridgeSnapshot.rate;
      }
      try {
        const fallbackConversion = await convert(
          amountInBase,
          base,
          normalizedDisplay,
          snapshot.capturedAt,
        );
        return fallbackConversion.amount;
      } catch (_error) {
        const viaRate = convertAmount(
          amountInBase,
          base,
          normalizedDisplay,
          rateMap,
        );
        return viaRate ?? null;
      }
    }
  }
  try {
    const fallbackConversion = await convert(
      amount,
      normalizedAmountCurrency,
      normalizedDisplay,
      fallbackAsOf,
    );
    return fallbackConversion.amount;
  } catch (_error) {
    const viaRate = convertAmount(
      amount,
      normalizedAmountCurrency,
      normalizedDisplay,
      rateMap,
    );
    return viaRate ?? null;
  }
}
