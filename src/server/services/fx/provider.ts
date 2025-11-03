import { Prisma } from "@prisma/client";
import prisma from "@/server/db";
import { audit } from "@/server/services/audit";

type DecimalLike = number | { toNumber: () => number };

export type FxQuote = {
  id: string;
  base: string;
  quote: string;
  rate: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

export type FxLatestRate = {
  quote: string;
  rate: number | null;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
};

export type FxTimeSeriesPoint = {
  id: string;
  base: string;
  quote: string;
  rate: number;
  effectiveFrom: Date;
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

export type FxProviderConfig = {
  cacheTtlMs?: number;
};

export type GetQuoteParams = {
  base: string;
  quote: string;
  asOf?: Date;
  allowMissing?: boolean;
};

export type GetTimeSeriesParams = {
  base: string;
  quote: string;
  from: Date;
  to?: Date;
};

export type EnsureSnapshotParams = {
  base: string;
  quote: string;
  asOf?: Date;
  createdBy?: string;
  allowMissing?: boolean;
};

export type ConvertResult = {
  amount: number;
  effectiveRate: number;
  viaCurrency: string;
  rateAtoUsd: number;
  rateUsdToB: number;
  fxEffectiveAt: Date | null;
  snapshots: FxSnapshotInfo[];
};

type CacheEntry<T> = {
  expiresAt: number;
  value: Promise<T>;
};

type FxRateRecord = {
  id: string;
  base: string;
  quote: string;
  rate: DecimalLike;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

type FxSnapshotRecord = {
  id: string;
  baseCurrency: string;
  quoteCurrency: string;
  rate: DecimalLike;
  capturedAt: Date;
  sourceRateId: string | null;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
};

const USD = "USD";
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

function toNumber(value: DecimalLike): number {
  return typeof value === "number" ? value : value.toNumber();
}

function asUtcIso(value: Date | undefined | null, fallback: string): string {
  if (!value) return fallback;
  return value.toISOString();
}

export class FxProvider {
  private quoteCache = new Map<string, CacheEntry<FxQuote | null>>();
  private latestCache = new Map<string, CacheEntry<FxLatestRate[]>>();
  private snapshotCache = new Map<string, CacheEntry<FxSnapshotInfo | null>>();
  private timeSeriesCache = new Map<string, CacheEntry<FxTimeSeriesPoint[]>>();

  private config: Required<FxProviderConfig> = {
    cacheTtlMs: DEFAULT_CACHE_TTL_MS,
  };

  constructor(config?: FxProviderConfig) {
    if (config?.cacheTtlMs) {
      this.config.cacheTtlMs = config.cacheTtlMs;
    }
  }

  setConfig(config: FxProviderConfig) {
    if (config.cacheTtlMs && config.cacheTtlMs > 0) {
      this.config.cacheTtlMs = config.cacheTtlMs;
    }
    this.clearCaches();
  }

  clearCaches() {
    this.quoteCache.clear();
    this.latestCache.clear();
    this.snapshotCache.clear();
    this.timeSeriesCache.clear();
  }

  async getQuote(params: GetQuoteParams): Promise<FxQuote | null> {
    const normalizedBase = params.base.toUpperCase();
    const normalizedQuote = params.quote.toUpperCase();
    if (normalizedBase === normalizedQuote) {
      return {
        id: "fx-self",
        base: normalizedBase,
        quote: normalizedQuote,
        rate: 1,
        effectiveFrom: params.asOf ?? new Date(),
        effectiveTo: null,
      };
    }
    const key = [
      "quote",
      normalizedBase,
      normalizedQuote,
      asUtcIso(params.asOf, "latest"),
      params.allowMissing ? "allow" : "strict",
    ].join("::");
    const cached = this.getCached(this.quoteCache, key);
    if (cached) return cached;

    const promise = this.fetchQuoteFromDb({
      base: normalizedBase,
      quote: normalizedQuote,
      asOf: params.asOf,
    }).then((record) => {
      if (!record) {
        return null;
      }
      return {
        id: record.id,
        base: record.base.toUpperCase(),
        quote: record.quote.toUpperCase(),
        rate: toNumber(record.rate),
        effectiveFrom: record.effectiveFrom,
        effectiveTo: record.effectiveTo ?? null,
      };
    });

    return this.storeCached(this.quoteCache, key, promise);
  }

  async getLatestRates(
    base: string,
    quotes: string[],
    at = new Date(),
  ): Promise<FxLatestRate[]> {
    const normalizedBase = base.toUpperCase();
    const requestedQuotes = Array.from(
      new Set(quotes.map((item) => item.toUpperCase())),
    );
    const sortedForCache = [...requestedQuotes].sort();
    const cacheKey = [
      "latest",
      normalizedBase,
      sortedForCache.join(","),
      asUtcIso(at, "now"),
    ].join("::");
    const cached = this.getCached(this.latestCache, cacheKey);
    if (cached) return cached;

    const promise = this.fetchLatestRatesFromDb(
      normalizedBase,
      sortedForCache,
      at,
    ).then((sortedResults) => {
      const lookup = new Map(sortedResults.map((item) => [item.quote, item]));
      return requestedQuotes.map((quote) => {
        const found = lookup.get(quote);
        return (
          found ?? {
            quote,
            rate: null,
            effectiveFrom: null,
            effectiveTo: null,
          }
        );
      });
    });

    return this.storeCached(this.latestCache, cacheKey, promise);
  }

  async getTimeSeries(params: GetTimeSeriesParams): Promise<FxTimeSeriesPoint[]> {
    const normalizedBase = params.base.toUpperCase();
    const normalizedQuote = params.quote.toUpperCase();
    const fromIso = asUtcIso(params.from, "from");
    const toIso = asUtcIso(params.to ?? null, "open");
    const cacheKey = [
      "series",
      normalizedBase,
      normalizedQuote,
      fromIso,
      toIso,
    ].join("::");
    const cached = this.getCached(this.timeSeriesCache, cacheKey);
    if (cached) return cached;

    const promise = this.fetchTimeSeriesFromDb({
      base: normalizedBase,
      quote: normalizedQuote,
      from: params.from,
      to: params.to,
    });

    return this.storeCached(this.timeSeriesCache, cacheKey, promise);
  }

  async ensureSnapshot(
    params: EnsureSnapshotParams,
  ): Promise<FxSnapshotInfo | null> {
    const normalizedBase = params.base.toUpperCase();
    const normalizedQuote = params.quote.toUpperCase();
    if (normalizedBase === normalizedQuote) return null;
    const asOf = params.asOf ?? new Date();
    const cacheKey = [
      "snapshot",
      normalizedBase,
      normalizedQuote,
      asUtcIso(asOf, "latest"),
      params.allowMissing ? "allow" : "strict",
    ].join("::");
    const cached = this.getCached(this.snapshotCache, cacheKey);
    if (cached) return cached;

    const promise = this.createOrReuseSnapshot({
      base: normalizedBase,
      quote: normalizedQuote,
      asOf,
      createdBy: params.createdBy,
      allowMissing: params.allowMissing ?? false,
    }).catch((error) => {
      this.snapshotCache.delete(cacheKey);
      throw error;
    });

    return this.storeCached(this.snapshotCache, cacheKey, promise);
  }

  async ensureSnapshotBatch(
    requests: EnsureSnapshotParams[],
  ): Promise<(FxSnapshotInfo | null)[]> {
    if (requests.length === 0) return [];
    return Promise.all(requests.map((req) => this.ensureSnapshot(req)));
  }

  async convert(
    amount: number,
    from: string,
    to: string,
    asOf?: Date,
  ): Promise<ConvertResult> {
    const normalizedFrom = from.toUpperCase();
    const normalizedTo = to.toUpperCase();
    if (amount === 0 || normalizedFrom === normalizedTo) {
      return {
        amount,
        effectiveRate: normalizedFrom === normalizedTo ? 1 : 0,
        viaCurrency: USD,
        rateAtoUsd: normalizedFrom === USD ? 1 : 0,
        rateUsdToB: normalizedTo === USD ? 1 : 0,
        fxEffectiveAt: asOf ?? null,
        snapshots: [],
      };
    }
    const asOfDate = asOf ?? new Date();
    const fromInfo = await this.resolveUsdRate(
      normalizedFrom,
      asOfDate,
      false,
    );
    const toInfo = await this.resolveUsdRate(
      normalizedTo,
      asOfDate,
      normalizedTo === USD,
    );
    const amountInUsd = amount * fromInfo.currencyToUsd;
    const converted = amountInUsd * toInfo.usdToCurrency;
    const snapshots: FxSnapshotInfo[] = [];
    if (fromInfo.snapshot) snapshots.push(fromInfo.snapshot);
    if (toInfo.snapshot) {
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

  private getCached<T>(
    store: Map<string, CacheEntry<T>>,
    key: string,
  ): Promise<T> | null {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt > Date.now()) {
      return entry.value;
    }
    store.delete(key);
    return null;
  }

  private storeCached<T>(
    store: Map<string, CacheEntry<T>>,
    key: string,
    promise: Promise<T>,
  ): Promise<T> {
    store.set(key, {
      value: promise,
      expiresAt: Date.now() + this.config.cacheTtlMs,
    });
    return promise;
  }

  private async fetchQuoteFromDb(params: {
    base: string;
    quote: string;
    asOf?: Date;
  }): Promise<FxRateRecord | null> {
    const delegate = prisma.fxRate;
    if (!delegate) return null;
    if (typeof delegate.findFirst === "function") {
      if (params.asOf) {
        const at = params.asOf;
        return delegate.findFirst({
          where: {
            base: params.base,
            quote: params.quote,
            effectiveFrom: { lte: at },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
          },
          orderBy: { effectiveFrom: "desc" },
        });
      }
      return delegate.findFirst({
        where: { base: params.base, quote: params.quote },
        orderBy: { effectiveFrom: "desc" },
      });
    }
    if (typeof delegate.findMany === "function") {
      const rows: FxRateRecord[] = await delegate.findMany({
        where: {
          base: params.base,
          quote: params.quote,
          ...(params.asOf
            ? {
                effectiveFrom: { lte: params.asOf },
                OR: [
                  { effectiveTo: null },
                  { effectiveTo: { gt: params.asOf } },
                ],
              }
            : undefined),
        },
        orderBy: { effectiveFrom: "desc" },
      });
      return rows[0] ?? null;
    }
    return null;
  }

  private async fetchLatestRatesFromDb(
    base: string,
    quotes: string[],
    at: Date,
  ): Promise<FxLatestRate[]> {
    if (quotes.length === 0) return [];
    const delegate = prisma.fxRate;
    let rows: FxRateRecord[] = [];
    if (delegate && typeof delegate.findMany === "function") {
      rows = await delegate.findMany({
        where: {
          base,
          quote: { in: quotes },
          effectiveFrom: { lte: at },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
        },
        orderBy: { effectiveFrom: "desc" },
      });
    }
    const latest = new Map<
      string,
      { rate: number; effectiveFrom: Date; effectiveTo: Date | null }
    >();
    rows.forEach((row) => {
      const quote = row.quote.toUpperCase();
      if (!latest.has(quote)) {
        latest.set(quote, {
          rate: toNumber(row.rate),
          effectiveFrom: row.effectiveFrom,
          effectiveTo: row.effectiveTo ?? null,
        });
      }
    });
    return quotes.map((quote) => {
      const found = latest.get(quote);
      return {
        quote,
        rate: found?.rate ?? null,
        effectiveFrom: found?.effectiveFrom ?? null,
        effectiveTo: found?.effectiveTo ?? null,
      };
    });
  }

  private async fetchTimeSeriesFromDb(params: {
    base: string;
    quote: string;
    from: Date;
    to?: Date;
  }): Promise<FxTimeSeriesPoint[]> {
    const delegate = prisma.fxRate;
    if (!delegate || typeof delegate.findMany !== "function") return [];
    const where: Record<string, unknown> = {
      base: params.base,
      quote: params.quote,
      effectiveFrom: { lte: params.to ?? new Date("9999-12-31T23:59:59Z") },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gt: params.from } },
      ],
    };
    const rows: FxRateRecord[] = await delegate.findMany({
      where,
      orderBy: { effectiveFrom: "asc" },
    });
    return rows
      .filter((row) => row.effectiveFrom <= (params.to ?? row.effectiveFrom))
      .map((row) => ({
        id: row.id,
        base: row.base.toUpperCase(),
        quote: row.quote.toUpperCase(),
        rate: toNumber(row.rate),
        effectiveFrom: row.effectiveFrom,
        effectiveTo: row.effectiveTo ?? null,
      }));
  }

  private async createOrReuseSnapshot(params: {
    base: string;
    quote: string;
    asOf: Date;
    createdBy?: string;
    allowMissing: boolean;
  }): Promise<FxSnapshotInfo | null> {
    const rateRecord = await this.getQuote({
      base: params.base,
      quote: params.quote,
      asOf: params.asOf,
    });
    if (!rateRecord) {
      if (!params.allowMissing) {
        await audit.log("FX_RATE_MISSING", {
          meta: {
            base: params.base,
            quote: params.quote,
            asOf: params.asOf.toISOString(),
          },
        });
        throw new Error(
          `fx_rate_missing:${params.base}-${params.quote}-${params.asOf.toISOString()}`,
        );
      }
      return null;
    }

    const existing = await this.fxSnapshotFindFirst({
      where: {
        baseCurrency: params.base,
        quoteCurrency: params.quote,
        sourceRateId: rateRecord.id,
        capturedAt: params.asOf,
      },
    });
    if (existing) return this.mapSnapshot(existing);

    try {
      const created = await this.fxSnapshotCreate({
        data: {
          baseCurrency: params.base,
          quoteCurrency: params.quote,
          rate: rateRecord.rate,
          capturedAt: params.asOf,
          sourceRateId: rateRecord.id,
          effectiveFrom: rateRecord.effectiveFrom,
          effectiveTo: rateRecord.effectiveTo,
          createdBy: params.createdBy ?? "system",
        },
      });
      return this.mapSnapshot(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const retry = await this.fxSnapshotFindFirst({
          where: {
            baseCurrency: params.base,
            quoteCurrency: params.quote,
            sourceRateId: rateRecord.id,
            capturedAt: params.asOf,
          },
        });
        if (retry) return this.mapSnapshot(retry);
      }
      throw error;
    }
  }

  private async resolveUsdRate(
    currency: string,
    asOf: Date,
    allowMissing: boolean,
  ): Promise<{
    usdToCurrency: number;
    currencyToUsd: number;
    snapshot: FxSnapshotInfo | null;
  }> {
    if (currency === USD) {
      return {
        usdToCurrency: 1,
        currencyToUsd: 1,
        snapshot: null,
      };
    }
    const snapshot = await this.ensureSnapshot({
      base: USD,
      quote: currency,
      asOf,
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

  private async fxSnapshotFindFirst(
    args: Record<string, unknown>,
  ): Promise<FxSnapshotRecord | null> {
    const delegate = prisma.fxSnapshot;
    if (delegate && typeof delegate.findFirst === "function") {
      return delegate.findFirst(args);
    }
    return null;
  }

  private async fxSnapshotCreate(
    args: Record<string, unknown>,
  ): Promise<FxSnapshotRecord> {
    const delegate = (prisma as unknown as Record<string, any>).fxSnapshot;
    if (delegate && typeof delegate.create === "function") {
      return delegate.create(args);
    }
    throw new Error("fxSnapshot.create not available");
  }

  private mapSnapshot(record: FxSnapshotRecord): FxSnapshotInfo {
    return {
      id: record.id,
      baseCurrency: record.baseCurrency,
      quoteCurrency: record.quoteCurrency,
      rate: toNumber(record.rate),
      capturedAt: record.capturedAt,
      sourceRateId: record.sourceRateId,
      effectiveFrom: record.effectiveFrom,
      effectiveTo: record.effectiveTo,
    };
  }
}

export const fxProvider = new FxProvider();

export function getFxProvider(): FxProvider {
  return fxProvider;
}

export const getQuote = (params: GetQuoteParams) =>
  fxProvider.getQuote(params);
export const getLatestRates = (
  base: string,
  quotes: string[],
  at?: Date,
) => fxProvider.getLatestRates(base, quotes, at);
export const getTimeSeries = (params: GetTimeSeriesParams) =>
  fxProvider.getTimeSeries(params);
export const ensureFxSnapshot = (params: EnsureSnapshotParams) =>
  fxProvider.ensureSnapshot(params);
export const ensureFxSnapshotBatch = (requests: EnsureSnapshotParams[]) =>
  fxProvider.ensureSnapshotBatch(requests);
export const convert = (
  amount: number,
  from: string,
  to: string,
  asOf?: Date,
) => fxProvider.convert(amount, from, to, asOf);
export const clearFxCache = () => fxProvider.clearCaches();
