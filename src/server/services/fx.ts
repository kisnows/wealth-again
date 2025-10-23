import { Prisma } from "@prisma/client";
import prisma from "@/server/db";
import { logAudit } from "@/server/services/audit";

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

export type FxSnapshotInfo = {
  id: string;
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  capturedAt: Date;
  sourceRateId: string | null;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
};

const USD = "USD";
const SNAPSHOT_CACHE_TTL_MS = 5 * 60 * 1000;

type SnapshotCacheEntry = {
  expiresAt: number;
  promise: Promise<FxSnapshotInfo | null>;
};

const snapshotCache = new Map<string, SnapshotCacheEntry>();

async function fxRateFindFirstSafe(
  args: Record<string, unknown>,
): Promise<FxRateRecord | null> {
  const delegate = (prisma as unknown as Record<string, any>).fxRate;
  if (delegate && typeof delegate.findFirst === "function") {
    return delegate.findFirst(args);
  }
  if (delegate && typeof delegate.findMany === "function") {
    const rows = (await delegate.findMany(args)) as FxRateRecord[];
    return rows[0] ?? null;
  }
  return null;
}

async function fxRateFindManySafe(
  args: Record<string, unknown>,
): Promise<FxRateRecord[]> {
  const delegate = (prisma as unknown as Record<string, any>).fxRate;
  if (delegate && typeof delegate.findMany === "function") {
    return delegate.findMany(args);
  }
  return [];
}

async function fxSnapshotFindFirstSafe(
  args: Record<string, unknown>,
): Promise<FxSnapshotRecord | null> {
  const delegate = (prisma as unknown as Record<string, any>).fxSnapshot;
  if (delegate && typeof delegate.findFirst === "function") {
    return delegate.findFirst(args);
  }
  return null;
}

async function fxSnapshotCreateSafe(
  args: Record<string, unknown>,
): Promise<FxSnapshotRecord> {
  const delegate = (prisma as unknown as Record<string, any>).fxSnapshot;
  if (delegate && typeof delegate.create === "function") {
    return delegate.create(args);
  }
  throw new Error("fxSnapshot.create not available");
}

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

  const cacheKey = `${normalizedBase}::${normalizedQuote}::${asOfDate.toISOString()}::${allowMissing ? "allow" : "strict"}`;
  const cached = snapshotCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = (async () => {
    const rateRecord = await getFxRate({
      base: normalizedBase,
      quote: normalizedQuote,
      asOf: asOfDate,
    });
    if (!rateRecord) {
      if (!allowMissing) {
        await logAudit("FX_RATE_MISSING", {
          meta: {
            base: normalizedBase,
            quote: normalizedQuote,
            asOf: asOfDate.toISOString(),
          },
        });
        throw new Error(
          `fx_rate_missing:${normalizedBase}-${normalizedQuote}-${asOfDate.toISOString()}`,
        );
      }
      return null;
    }

    const existing = await fxSnapshotFindFirstSafe({
      where: {
        baseCurrency: normalizedBase,
        quoteCurrency: normalizedQuote,
        sourceRateId: rateRecord.id,
        capturedAt: asOfDate,
      },
    });
    if (existing) return mapSnapshot(existing);

    let created: FxSnapshotRecord | null = null;
    try {
      created = await fxSnapshotCreateSafe({
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
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const retry = await fxSnapshotFindFirstSafe({
          where: {
            baseCurrency: normalizedBase,
            quoteCurrency: normalizedQuote,
            sourceRateId: rateRecord.id,
            capturedAt: asOfDate,
          },
        });
        if (retry) return mapSnapshot(retry);
      }
      throw error;
    }
    if (!created) throw new Error("fx_snapshot_not_created");
    return mapSnapshot(created);
  })().catch((error) => {
    snapshotCache.delete(cacheKey);
    throw error;
  });

  snapshotCache.set(cacheKey, {
    promise,
    expiresAt: now + SNAPSHOT_CACHE_TTL_MS,
  });
  return promise;
}

export function clearFxSnapshotCache() {
  snapshotCache.clear();
}

export async function ensureFxSnapshotBatch(
  requests: Array<{
    base: string;
    quote: string;
    asOf?: Date;
    createdBy?: string;
    allowMissing?: boolean;
  }>,
): Promise<(FxSnapshotInfo | null)[]> {
  if (requests.length === 0) return [];
  const results = await Promise.all(
    requests.map((request) => ensureFxSnapshot(request)),
  );
  return results;
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
    return fxRateFindFirstSafe({
      where: {
        base,
        quote,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      },
      orderBy: { effectiveFrom: "desc" },
    });
  }
  return fxRateFindFirstSafe({
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
  const rows = await fxRateFindManySafe({
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
