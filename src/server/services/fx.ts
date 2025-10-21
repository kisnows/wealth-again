import prisma from "@/server/db";

type FxRateRecord = {
  id: string;
  base: string;
  quote: string;
  rate: number | { toNumber: () => number };
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

const fxRateClient = prisma.fxRate as unknown as {
  findFirst: (args: unknown) => Promise<FxRateRecord | null>;
  findMany: (args: unknown) => Promise<FxRateRecord[]>;
};
const USD = "USD";

export async function getFxRate(params: {
  base: string;
  quote: string;
  asOf?: Date;
}) {
  const base = params.base.toUpperCase();
  const quote = params.quote.toUpperCase();
  if (params.asOf) {
    const at = params.asOf;
    return fxRateClient.findFirst({
      where: {
        base,
        quote,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      },
      orderBy: { effectiveFrom: "desc" },
    });
  }
  return fxRateClient.findFirst({
    where: { base, quote },
    orderBy: { effectiveFrom: "desc" },
  });
}

export async function getLatestRates(
  base: string,
  quotes: string[],
  at = new Date(),
) {
  if (quotes.length === 0)
    return [] as Array<{
      quote: string;
      rate: number | null;
      effectiveFrom: Date | null;
      effectiveTo: Date | null;
    }>;
  const upperBase = base.toUpperCase();
  const upperQuotes = Array.from(
    new Set(quotes.map((quote) => quote.toUpperCase())),
  );
  const rows = await fxRateClient.findMany({
    where: {
      base: upperBase,
      quote: { in: upperQuotes },
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
  const latest = new Map<
    string,
    { rate: number; effectiveFrom: Date; effectiveTo: Date | null }
  >();
  rows.forEach((row) => {
    const quote = row.quote.toUpperCase();
    if (!latest.has(quote)) {
      latest.set(quote, {
        rate: typeof row.rate === "number" ? row.rate : row.rate.toNumber(),
        effectiveFrom: row.effectiveFrom,
        effectiveTo: row.effectiveTo ?? null,
      });
    }
  });
  return upperQuotes.map((quote) => {
    const found = latest.get(quote);
    return {
      quote,
      rate: found ? found.rate : null,
      effectiveFrom: found?.effectiveFrom ?? null,
      effectiveTo: found?.effectiveTo ?? null,
    };
  });
}

type FxSnapshot = {
  id?: string;
  base: string;
  quote: string;
  rate: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

type ResolvedRate = {
  usdToCurrency: number;
  currencyToUsd: number;
  snapshot: FxSnapshot | null;
};

async function resolveUsdRate(
  currency: string,
  asOf: Date | undefined,
  allowMissing: boolean,
): Promise<ResolvedRate> {
  if (currency === USD) {
    return {
      usdToCurrency: 1,
      currencyToUsd: 1,
      snapshot: null,
    };
  }
  const record = await getFxRate({ base: USD, quote: currency, asOf });
  if (!record) {
    if (allowMissing) {
      return {
        usdToCurrency: 1,
        currencyToUsd: 1,
        snapshot: null,
      };
    }
    throw new Error("rate missing");
  }
  const rate =
    typeof record.rate === "number" ? record.rate : record.rate.toNumber();
  return {
    usdToCurrency: rate,
    currencyToUsd: rate === 0 ? 0 : 1 / rate,
    snapshot: {
      id: record.id,
      base: record.base,
      quote: record.quote,
      rate,
      effectiveFrom: record.effectiveFrom,
      effectiveTo: record.effectiveTo ?? null,
    },
  };
}

export async function convert(
  amount: number,
  from: string,
  to: string,
  asOf?: Date,
): Promise<{
  amount: number;
  effectiveRate: number;
  viaCurrency: string;
  rateAtoUsd: number;
  rateUsdToB: number;
  fxEffectiveAt: Date | null;
  snapshots: FxSnapshot[];
}> {
  const normalizedFrom = from.toUpperCase();
  const normalizedTo = to.toUpperCase();
  const sameCurrency = normalizedFrom === normalizedTo;
  if (amount === 0 || sameCurrency) {
    return {
      amount,
      effectiveRate: sameCurrency ? 1 : 0,
      viaCurrency: USD,
      rateAtoUsd: sameCurrency ? 1 : normalizedFrom === USD ? 1 : 0,
      rateUsdToB: sameCurrency ? 1 : normalizedTo === USD ? 1 : 0,
      fxEffectiveAt: asOf ?? null,
      snapshots: [],
    };
  }
  const asOfDate = asOf ?? new Date();
  const fromInfo = await resolveUsdRate(normalizedFrom, asOf, false);
  const toInfo = await resolveUsdRate(normalizedTo, asOf, normalizedTo === USD);
  const amountInUsd = amount * fromInfo.currencyToUsd;
  const converted = amountInUsd * toInfo.usdToCurrency;
  const snapshots = [] as FxSnapshot[];
  if (fromInfo.snapshot) snapshots.push(fromInfo.snapshot);
  if (
    toInfo.snapshot &&
    (to.toUpperCase() !== USD || from.toUpperCase() !== USD)
  ) {
    if (
      !fromInfo.snapshot ||
      fromInfo.snapshot.quote !== toInfo.snapshot.quote
    ) {
      snapshots.push(toInfo.snapshot);
    }
  }
  const fxEffectiveAt =
    toInfo.snapshot?.effectiveFrom ??
    fromInfo.snapshot?.effectiveFrom ??
    asOfDate;
  return {
    amount: converted,
    effectiveRate: converted / amount,
    viaCurrency: USD,
    rateAtoUsd: fromInfo.currencyToUsd,
    rateUsdToB: toInfo.usdToCurrency,
    fxEffectiveAt,
    snapshots,
  };
}
