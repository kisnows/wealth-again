/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({ log: ["error", "warn"] });
const SNAPSHOT_CREATED_BY = "backfill-script";
const snapshotCache = new Map();

function toNumber(value) {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  if (typeof value.toNumber === "function") return value.toNumber();
  return Number(value);
}

function buildSnapshotCacheKey(base, quote, asOf) {
  return `${base.toUpperCase()}::${quote.toUpperCase()}::${asOf.toISOString()}`;
}

async function getFxRate({ base, quote, asOf }) {
  const where = {
    base: base.toUpperCase(),
    quote: quote.toUpperCase(),
  };
  if (asOf) {
    return prisma.fxRate.findFirst({
      where: {
        ...where,
        effectiveFrom: { lte: asOf },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }],
      },
      orderBy: { effectiveFrom: "desc" },
    });
  }
  return prisma.fxRate.findFirst({
    where,
    orderBy: { effectiveFrom: "desc" },
  });
}

async function ensureSnapshot({ base, quote, asOf, allowMissing = false }) {
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
        const existing = await prisma.fxSnapshot.findFirst({
          where: {
            baseCurrency: normalizedBase,
            quoteCurrency: normalizedQuote,
            sourceRateId: rateRecord.id,
            capturedAt: asOf,
          },
        });
        if (existing) return existing;
        try {
          return await prisma.fxSnapshot.create({
            data: {
              baseCurrency: normalizedBase,
              quoteCurrency: normalizedQuote,
              rate: toNumber(rateRecord.rate),
              capturedAt: asOf,
              sourceRateId: rateRecord.id,
              effectiveFrom: rateRecord.effectiveFrom,
              effectiveTo: rateRecord.effectiveTo,
              createdBy: SNAPSHOT_CREATED_BY,
            },
          });
        } catch (error) {
          if (error && error.code === "P2002") {
            return prisma.fxSnapshot.findFirst({
              where: {
                baseCurrency: normalizedBase,
                quoteCurrency: normalizedQuote,
                sourceRateId: rateRecord.id,
                capturedAt: asOf,
              },
            });
          }
          console.error(
            `[snapshot] create failed base=${normalizedBase} quote=${normalizedQuote} asOf=${asOf.toISOString()}`,
            error,
          );
          return null;
        }
      })(),
    );
  }
  return snapshotCache.get(key);
}

function parseMetaSnapshots(meta) {
  if (!meta) return [];
  let parsed = meta;
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
  const rates = await prisma.fxRate.findMany();
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

async function resolveIncomeSnapshot(record, attachedRate) {
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
  const records = await prisma.incomeRecord.findMany({
    include: { fxRate: true },
  });
  let updated = 0;
  const missing = [];
  for (const record of records) {
    if (record.fxSnapshotId) continue;
    const snapshot = await resolveIncomeSnapshot(record, record.fxRate);
    if (!snapshot) {
      missing.push(record.id);
      continue;
    }
    await prisma.incomeRecord.update({
      where: { id: record.id },
      data: {
        fxSnapshotId: snapshot.id,
        fxAppliedRate: toNumber(snapshot.rate) ?? 1,
        sourceCurrency: record.sourceCurrency || record.currency,
      },
    });
    updated += 1;
  }
  console.log(
    `[income] total=${records.length} updated=${updated} missing=${missing.length}`,
  );
  if (missing.length) console.warn("[income] missing snapshot ids:", missing);
}

async function resolveEntrySnapshot(entry) {
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
      const found = await prisma.fxSnapshot.findUnique({
        where: { id: item.snapshotId },
      });
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
    new Set(entry.lines.map((line) => line.currency.toUpperCase())),
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

async function updateLineSnapshot(line, snapshot) {
  if (!snapshot) return false;
  const currency = line.currency.toUpperCase();
  if (
    currency !== snapshot.baseCurrency.toUpperCase() &&
    currency !== snapshot.quoteCurrency.toUpperCase()
  ) {
    return false;
  }
  await prisma.txnLine.update({
    where: { id: line.id },
    data: {
      fxSnapshotId: snapshot.id,
      fxAppliedRate: toNumber(snapshot.rate) ?? 1,
    },
  });
  return true;
}

async function backfillTxnEntries() {
  const entries = await prisma.txnEntry.findMany({
    include: { fxRate: true, lines: true },
  });
  let updatedEntries = 0;
  let updatedLines = 0;
  const missing = [];
  for (const entry of entries) {
    if (entry.fxSnapshotId) continue;
    const snapshot = await resolveEntrySnapshot(entry);
    if (!snapshot) {
      missing.push(entry.id);
      continue;
    }
    await prisma.txnEntry.update({
      where: { id: entry.id },
      data: {
        fxSnapshotId: snapshot.id,
        fxAppliedRate: toNumber(snapshot.rate) ?? 1,
      },
    });
    updatedEntries += 1;
    for (const line of entry.lines) {
      const updated = await updateLineSnapshot(line, snapshot);
      if (updated) updatedLines += 1;
    }
  }
  console.log(
    `[txnEntry] total=${entries.length} updatedEntries=${updatedEntries} updatedLines=${updatedLines} missing=${missing.length}`,
  );
  if (missing.length) console.warn("[txnEntry] missing snapshot entry ids:", missing);
}

async function resolveValuationSnapshot(valuation) {
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
  const valuations = await prisma.valuationSnapshot.findMany({
    include: { fxRate: true },
  });
  let updated = 0;
  const missing = [];
  for (const valuation of valuations) {
    if (valuation.fxSnapshotId) continue;
    const snapshot = await resolveValuationSnapshot(valuation);
    if (!snapshot) {
      missing.push(valuation.id);
      continue;
    }
    await prisma.valuationSnapshot.update({
      where: { id: valuation.id },
      data: {
        fxSnapshotId: snapshot.id,
        fxAppliedRate: toNumber(snapshot.rate) ?? 1,
      },
    });
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

main()
  .catch((error) => {
    console.error("[backfill] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
