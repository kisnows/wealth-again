import prisma from "@/server/db";

type FxRateRecord = {
  id: string;
  base: string;
  quote: string;
  rate: number | { toNumber: () => number };
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

type FxSnapshotRecord = {
  id: string;
  baseCurrency: string;
  quoteCurrency: string;
  rate: number | { toNumber: () => number };
  capturedAt: Date;
  sourceRateId: string | null;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
};

type FxSnapshotInfo = {
  id: string;
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  capturedAt: Date;
  sourceRateId: string | null;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
};

const fxRateClient = prisma.fxRate as unknown as {
  findFirst: (args: unknown) => Promise<FxRateRecord | null>;
  findMany: (args: unknown) => Promise<FxRateRecord[]>;
};
const fxSnapshotClient = prisma.fxSnapshot as unknown as {
  findFirst: (args: unknown) => Promise<FxSnapshotRecord | null>;
  create: (args: unknown) => Promise<FxSnapshotRecord>;
};
const USD = "USD";

function toRateValue(value: number | { toNumber: () => number }): number {
  return typeof value === "number" ? value : value.toNumber();
}

function mapSnapshot(record: FxSnapshotRecord): FxSnapshotInfo {
  return {
    id: record.id,
    baseCurrency: record.baseCurrency,
    quoteCurrency: record.quoteCurrency,
    rate: toRateValue(record.rate),
    capturedAt: record.capturedAt,
    sourceRateId: record.sourceRateId,
    effectiveFrom: record.effectiveFrom,
    effectiveTo: record.effectiveTo,
  };
}

export async function ensureFxSnapshot({
  base,
  quote,
  asOf,
  createdBy,
  allowMissing = false,
}: {
  base: string;
  quote: string;
  asOf?: Date;
  createdBy?: string;
  allowMissing?: boolean;
}): Promise<FxSnapshotInfo | null> {
  const normalizedBase = base.toUpperCase();
  const normalizedQuote = quote.toUpperCase();
  if (normalizedBase === normalizedQuote) return null;
  const asOfDate = asOf ?? new Date();
  const rateRecord = await getFxRate({
    base: normalizedBase,
    quote: normalizedQuote,
    asOf: asOfDate,
  });
  if (!rateRecord) {
    if (allowMissing) return null;
    throw new Error("rate missing");
  }

  const existing = await fxSnapshotClient.findFirst({
    where: {
      baseCurrency: normalizedBase,
      quoteCurrency: normalizedQuote,
      sourceRateId: rateRecord.id,
      capturedAt: asOfDate,
    },
  });
  if (existing) return mapSnapshot(existing);

  const created = await fxSnapshotClient.create({
    data: {
      baseCurrency: normalizedBase,
      quoteCurrency: normalizedQuote,
      rate: toRateValue(rateRecord.rate),
      capturedAt: asOfDate,
      sourceRateId: rateRecord.id,
      effectiveFrom: rateRecord.effectiveFrom,
      effectiveTo: rateRecord.effectiveTo,
      createdBy: createdBy ?? "system",
    },
  });
  return mapSnapshot(created);
}

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
        rate: toRateValue(row.rate),
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

type ResolvedRate = {
  usdToCurrency: number;
  currencyToUsd: number;
  snapshot: FxSnapshotInfo | null;
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
  const asOfDate = asOf ?? new Date();
  const snapshot = await ensureFxSnapshot({
    base: USD,
    quote: currency,
    asOf: asOfDate,
    allowMissing,
  });
  if (!snapshot) {
    return {
      usdToCurrency: 1,
      currencyToUsd: 1,
      snapshot: null,
    };
  }
  const rate = snapshot.rate;
  return {
    usdToCurrency: rate,
    currencyToUsd: rate === 0 ? 0 : 1 / rate,
    snapshot,
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
  snapshots: FxSnapshotInfo[];
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
  const snapshots = [] as FxSnapshotInfo[];
  if (fromInfo.snapshot) snapshots.push(fromInfo.snapshot);
  if (
    toInfo.snapshot &&
    (to.toUpperCase() !== USD || from.toUpperCase() !== USD)
  ) {
    if (
      !fromInfo.snapshot ||
      fromInfo.snapshot.quoteCurrency !== toInfo.snapshot.quoteCurrency
    ) {
      snapshots.push(toInfo.snapshot);
    }
  }
  const fxEffectiveAt =
    toInfo.snapshot?.capturedAt ??
    fromInfo.snapshot?.capturedAt ??
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
