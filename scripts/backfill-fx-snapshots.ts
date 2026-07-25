/* eslint-disable no-console */
import db from "../src/server/db";
import {
  fxRates,
  fxSnapshots,
  incomeRecords,
  txnEntries,
  txnLines,
  valuationSnapshots,
} from "../src/server/db/schema";
import { and, desc, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";

const SNAPSHOT_CREATED_BY = "backfill-script";
const snapshotCache = new Map<string, Promise<any>>();

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  if (typeof value === "object" && value !== null) {
    if (typeof (value as { toString?: () => string }).toString === "function") {
      return Number((value as { toString: () => string }).toString());
    }
  }
  return Number(value);
}

function buildSnapshotCacheKey(base: string, quote: string, asOf: Date) {
  return `${base.toUpperCase()}::${quote.toUpperCase()}::${asOf.toISOString()}`;
}

async function getFxRate({
  base,
  quote,
  asOf,
}: {
  base: string;
  quote: string;
  asOf?: Date;
}) {
  const normalizedBase = base.toUpperCase();
  const normalizedQuote = quote.toUpperCase();
  if (asOf) {
    const [record] = await db
      .select()
      .from(fxRates)
      .where(
        and(
          eq(fxRates.base, normalizedBase),
          eq(fxRates.quote, normalizedQuote),
          lte(fxRates.effectiveFrom, asOf),
          or(isNull(fxRates.effectiveTo), gt(fxRates.effectiveTo, asOf)),
        ),
      )
      .orderBy(desc(fxRates.effectiveFrom))
      .limit(1);
    return record ?? null;
  }
  const [record] = await db
    .select()
    .from(fxRates)
    .where(and(eq(fxRates.base, normalizedBase), eq(fxRates.quote, normalizedQuote)))
    .orderBy(desc(fxRates.effectiveFrom))
    .limit(1);
  return record ?? null;
}

async function ensureSnapshot({
  base,
  quote,
  asOf,
  allowMissing = false,
}: {
  base: string;
  quote: string;
  asOf: Date;
  allowMissing?: boolean;
}) {
  const normalizedBase = base.toUpperCase();
  const normalizedQuote = quote.toUpperCase();
  if (normalizedBase === normalizedQuote) return null;
  const key = buildSnapshotCacheKey(normalizedBase, normalizedQuote, asOf);
  if (!snapshotCache.has(key)) {
    snapshotCache.set(
      key,
      (async () => {
        const rateRecord = await getFxRate({
          base: normalizedBase,
          quote: normalizedQuote,
          asOf,
        });
        if (!rateRecord) {
          if (!allowMissing) {
            console.warn(
              `[snapshot] missing fxRate base=${normalizedBase} quote=${normalizedQuote} asOf=${asOf.toISOString()}`,
            );
          }
          return null;
        }
        const [existing] = await db
          .select()
          .from(fxSnapshots)
          .where(
            and(
              eq(fxSnapshots.baseCurrency, normalizedBase),
              eq(fxSnapshots.quoteCurrency, normalizedQuote),
              eq(fxSnapshots.sourceRateId, rateRecord.id),
              eq(fxSnapshots.capturedAt, asOf),
            ),
          )
          .limit(1);
        if (existing) return existing;
        await db
          .insert(fxSnapshots)
          .values({
            baseCurrency: normalizedBase,
            quoteCurrency: normalizedQuote,
            rate: String(toNumber(rateRecord.rate) ?? 0),
            capturedAt: asOf,
            sourceRateId: rateRecord.id,
            effectiveFrom: rateRecord.effectiveFrom,
            effectiveTo: rateRecord.effectiveTo,
            createdBy: SNAPSHOT_CREATED_BY,
          })
          .onConflictDoNothing();
        const [created] = await db
          .select()
          .from(fxSnapshots)
          .where(
            and(
              eq(fxSnapshots.baseCurrency, normalizedBase),
              eq(fxSnapshots.quoteCurrency, normalizedQuote),
              eq(fxSnapshots.sourceRateId, rateRecord.id),
              eq(fxSnapshots.capturedAt, asOf),
            ),
          )
          .limit(1);
        if (!created && !allowMissing) {
          console.warn(
            `[snapshot] create failed base=${normalizedBase} quote=${normalizedQuote} asOf=${asOf.toISOString()}`,
          );
        }
        return created ?? null;
      })(),
    );
  }
  return snapshotCache.get(key) ?? null;
}

function parseMetaSnapshots(meta: unknown) {
  if (!meta) return [];
  let parsed: any = meta;
  if (typeof meta === "string") {
    try {
      parsed = JSON.parse(meta);
    } catch {
      return [];
    }
  }
  if (!parsed || typeof parsed !== "object") return [];
  const list = parsed.rateSnapshots;
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const base = typeof item.base === "string" ? item.base : item.baseCurrency;
      const quote =
        typeof item.quote === "string" ? item.quote : item.quoteCurrency;
      const capturedAt = item.capturedAt || item.effectiveFrom;
      return {
        base: typeof base === "string" ? base : null,
        quote: typeof quote === "string" ? quote : null,
        capturedAt:
          typeof capturedAt === "string" ? new Date(capturedAt) : null,
        snapshotId:
          typeof item.id === "string"
            ? item.id
            : typeof item.snapshotId === "string"
              ? item.snapshotId
              : null,
        sourceRateId:
          typeof item.sourceRateId === "string" ? item.sourceRateId : null,
      };
    })
    .filter(Boolean);
}

async function backfillFxRates() {
  const rates = await db.select().from(fxRates);
  let count = 0;
  for (const rate of rates) {
    const snapshot = await ensureSnapshot({
      base: rate.base,
      quote: rate.quote,
      asOf: rate.effectiveFrom,
      allowMissing: false,
    });
    if (snapshot) count += 1;
  }
  console.log(`[fxRate] ensured snapshots=${count}`);
}

async function resolveIncomeSnapshot(record: any, attachedRate: any) {
  const sourceCurrency = (record.sourceCurrency || record.currency).toUpperCase();
  const displayCurrency = record.currency.toUpperCase();
  if (sourceCurrency === displayCurrency) return null;
  if (attachedRate) {
    const snapshot = await ensureSnapshot({
      base: attachedRate.base,
      quote: attachedRate.quote,
      asOf: record.monthDate,
      allowMissing: true,
    });
    if (snapshot) return snapshot;
  }
  return ensureSnapshot({
    base: sourceCurrency,
    quote: displayCurrency,
    asOf: record.monthDate,
    allowMissing: true,
  });
}

async function backfillIncomeRecords() {
  const records = await db
    .select({
      record: incomeRecords,
      fxRate: fxRates,
    })
    .from(incomeRecords)
    .leftJoin(fxRates, eq(fxRates.id, incomeRecords.fxRateId));
  let updated = 0;
  const missing: string[] = [];
  for (const row of records) {
    const record = row.record;
    const attachedRate = row.fxRate;
    if (record.fxSnapshotId) continue;
    const snapshot = await resolveIncomeSnapshot(record, attachedRate);
    if (!snapshot) {
      missing.push(record.id);
      continue;
    }
    await db
      .update(incomeRecords)
      .set({
        fxSnapshotId: snapshot.id,
        fxAppliedRate: String(toNumber(snapshot.rate) ?? 1),
        sourceCurrency: record.sourceCurrency || record.currency,
      })
      .where(eq(incomeRecords.id, record.id));
    updated += 1;
  }
  console.log(
    `[income] total=${records.length} updated=${updated} missing=${missing.length}`,
  );
  if (missing.length) console.warn("[income] missing snapshot ids:", missing);
}

async function resolveEntrySnapshot(entry: any) {
  if (entry.fxRate) {
    const snapshot = await ensureSnapshot({
      base: entry.fxRate.base,
      quote: entry.fxRate.quote,
      asOf: entry.occurredAt,
      allowMissing: true,
    });
    if (snapshot) return snapshot;
  }
  const metaSnapshots = parseMetaSnapshots(entry.meta);
  for (const item of metaSnapshots) {
    if (item.snapshotId) {
      const [found] = await db
        .select()
        .from(fxSnapshots)
        .where(eq(fxSnapshots.id, item.snapshotId))
        .limit(1);
      if (found) return found;
    }
    if (item.base && item.quote && item.capturedAt instanceof Date) {
      const snapshot = await ensureSnapshot({
        base: item.base,
        quote: item.quote,
        asOf: item.capturedAt,
        allowMissing: true,
      });
      if (snapshot) return snapshot;
    }
  }
  const currencies = Array.from(
    new Set(entry.lines.map((line: any) => line.currency.toUpperCase())),
  );
  if (currencies.length === 2) {
    return ensureSnapshot({
      base: currencies[0],
      quote: currencies[1],
      asOf: entry.occurredAt,
      allowMissing: true,
    });
  }
  return null;
}

async function updateLineSnapshot(line: any, snapshot: any) {
  if (!snapshot) return false;
  const currency = line.currency.toUpperCase();
  if (
    currency !== snapshot.baseCurrency.toUpperCase() &&
    currency !== snapshot.quoteCurrency.toUpperCase()
  ) {
    return false;
  }
  await db
    .update(txnLines)
    .set({
      fxSnapshotId: snapshot.id,
      fxAppliedRate: String(toNumber(snapshot.rate) ?? 1),
    })
    .where(eq(txnLines.id, line.id));
  return true;
}

async function backfillTxnEntries() {
  const entries = await db.select().from(txnEntries);
  const entryIds = entries.map((entry) => entry.id);
  const lines = entryIds.length
    ? await db
        .select()
        .from(txnLines)
        .where(inArray(txnLines.entryId, entryIds))
    : [];
  const linesByEntry = new Map<string, any[]>();
  for (const line of lines) {
    if (!linesByEntry.has(line.entryId)) {
      linesByEntry.set(line.entryId, []);
    }
    linesByEntry.get(line.entryId)?.push(line);
  }
  const fxRateIds = entries
    .map((entry) => entry.fxRateId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const rates = fxRateIds.length
    ? await db.select().from(fxRates).where(inArray(fxRates.id, fxRateIds))
    : [];
  const rateMap = new Map(rates.map((rate) => [rate.id, rate]));

  let updatedEntries = 0;
  let updatedLines = 0;
  const missing: string[] = [];
  for (const entry of entries) {
    if (entry.fxSnapshotId) continue;
    const enriched = {
      ...entry,
      fxRate: entry.fxRateId ? rateMap.get(entry.fxRateId) : null,
      lines: linesByEntry.get(entry.id) ?? [],
    };
    const snapshot = await resolveEntrySnapshot(enriched);
    if (!snapshot) {
      missing.push(entry.id);
      continue;
    }
    await db
      .update(txnEntries)
      .set({
        fxSnapshotId: snapshot.id,
        fxAppliedRate: String(toNumber(snapshot.rate) ?? 1),
      })
      .where(eq(txnEntries.id, entry.id));
    updatedEntries += 1;
    for (const line of enriched.lines) {
      const updated = await updateLineSnapshot(line, snapshot);
      if (updated) updatedLines += 1;
    }
  }
  console.log(
    `[txnEntry] total=${entries.length} updatedEntries=${updatedEntries} updatedLines=${updatedLines} missing=${missing.length}`,
  );
  if (missing.length)
    console.warn("[txnEntry] missing snapshot entry ids:", missing);
}

async function resolveValuationSnapshot(valuation: any) {
  if (valuation.fxRate) {
    return ensureSnapshot({
      base: valuation.fxRate.base,
      quote: valuation.fxRate.quote,
      asOf: valuation.asOf,
      allowMissing: true,
    });
  }
  return null;
}

async function backfillValuations() {
  const valuations = await db
    .select({
      valuation: valuationSnapshots,
      fxRate: fxRates,
    })
    .from(valuationSnapshots)
    .leftJoin(fxRates, eq(fxRates.id, valuationSnapshots.fxRateId));
  let updated = 0;
  const missing: string[] = [];
  for (const row of valuations) {
    const valuation = row.valuation;
    if (valuation.fxSnapshotId) continue;
    const snapshot = await resolveValuationSnapshot({
      ...valuation,
      fxRate: row.fxRate,
    });
    if (!snapshot) {
      missing.push(valuation.id);
      continue;
    }
    await db
      .update(valuationSnapshots)
      .set({
        fxSnapshotId: snapshot.id,
        fxAppliedRate: String(toNumber(snapshot.rate) ?? 1),
      })
      .where(eq(valuationSnapshots.id, valuation.id));
    updated += 1;
  }
  console.log(
    `[valuation] total=${valuations.length} updated=${updated} missing=${missing.length}`,
  );
  if (missing.length) console.warn("[valuation] missing snapshot ids:", missing);
}

async function main() {
  console.log("== backfill fx snapshots ==");
  await backfillFxRates();
  await backfillIncomeRecords();
  await backfillTxnEntries();
  await backfillValuations();
}

main().catch((error) => {
  console.error("[backfill] failed:", error);
  process.exitCode = 1;
});
