import type { FxRate } from "@/server/db/types";
import db from "@/server/db";
import { fxRates } from "@/server/db/schema";
import { and, eq, gt, isNull, lt, ne, or } from "drizzle-orm";

const END_OF_TIME = new Date("9999-12-31T23:59:59.999Z");

type NumericLike = number | { toNumber: () => number };

const toNumber = (value: NumericLike) =>
  typeof value === "number" ? value : value.toNumber();

export type UpsertFxRateInput = {
  base: string;
  quote: string;
  rate: number;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  tx?: typeof db;
};

export class FxRateOverlapError extends Error {
  constructor() {
    super("overlapping interval");
    this.name = "FxRateOverlapError";
  }
}

function upsertFxRateInternal(
  tx: typeof db,
  input: UpsertFxRateInput,
): FxRate {
  const normalizedBase = input.base.toUpperCase();
  const normalizedQuote = input.quote.toUpperCase();
  const fromDate = new Date(input.effectiveFrom);
  const toDate = input.effectiveTo ?? null;
  const newEnd = toDate ?? END_OF_TIME;

  const existingSameStart = tx
    .select()
    .from(fxRates)
    .where(
      and(
        eq(fxRates.base, normalizedBase),
        eq(fxRates.quote, normalizedQuote),
        eq(fxRates.effectiveFrom, fromDate),
      ),
    )
    .limit(1)
    .get();

  const overlapping = tx
    .select()
    .from(fxRates)
    .where(
      and(
        eq(fxRates.base, normalizedBase),
        eq(fxRates.quote, normalizedQuote),
        lt(fxRates.effectiveFrom, newEnd),
        or(isNull(fxRates.effectiveTo), gt(fxRates.effectiveTo, fromDate)),
      ),
    )
    .orderBy(fxRates.effectiveFrom)
    .all();

  for (const record of overlapping) {
    if (existingSameStart && record.id === existingSameStart.id) {
      continue;
    }
    const recordStart = new Date(record.effectiveFrom);
    const recordEnd =
      record.effectiveTo != null ? new Date(record.effectiveTo) : END_OF_TIME;

    if (recordEnd <= fromDate || recordStart >= newEnd) {
      continue;
    }

    if (recordStart < fromDate) {
      tx
        .update(fxRates)
        .set({ effectiveTo: fromDate })
        .where(eq(fxRates.id, record.id))
        .run();

      if (recordEnd > newEnd && newEnd !== END_OF_TIME) {
        tx
          .insert(fxRates)
          .values({
            base: normalizedBase,
            quote: normalizedQuote,
            rate: String(toNumber(record.rate as NumericLike)),
            effectiveFrom: newEnd,
            effectiveTo: record.effectiveTo,
          })
          .run();
      }
    } else {
      if (recordEnd > newEnd && newEnd !== END_OF_TIME) {
        tx
          .update(fxRates)
          .set({ effectiveFrom: newEnd })
          .where(eq(fxRates.id, record.id))
          .run();
      } else {
        tx.delete(fxRates).where(eq(fxRates.id, record.id)).run();
      }
    }
  }

  let result: FxRate;
  if (existingSameStart) {
    const updated = tx
      .update(fxRates)
      .set({
        rate: String(input.rate),
        effectiveTo: toDate,
      })
      .where(eq(fxRates.id, existingSameStart.id))
      .returning()
      .get();
    if (!updated) {
      throw new Error("fx_rate_update_failed");
    }
    result = updated;
  } else {
    const created = tx
      .insert(fxRates)
      .values({
        base: normalizedBase,
        quote: normalizedQuote,
        rate: String(input.rate),
        effectiveFrom: fromDate,
        effectiveTo: toDate,
      })
      .returning()
      .get();
    if (!created) {
      throw new Error("fx_rate_insert_failed");
    }
    result = created;
  }

  const overlappingAfter = tx
    .select()
    .from(fxRates)
    .where(
      and(
        eq(fxRates.base, normalizedBase),
        eq(fxRates.quote, normalizedQuote),
        ne(fxRates.id, result.id),
        lt(
          fxRates.effectiveFrom,
          result.effectiveTo ?? END_OF_TIME,
        ),
        or(
          isNull(fxRates.effectiveTo),
          gt(fxRates.effectiveTo, result.effectiveFrom),
        ),
      ),
    )
    .limit(1)
    .get();
  if (overlappingAfter) {
    throw new FxRateOverlapError();
  }
  return result;
}

export async function upsertFxRateWithContinuity(
  input: UpsertFxRateInput,
): Promise<FxRate> {
  if (input.tx) {
    return upsertFxRateInternal(input.tx, input);
  }
  return db.transaction((tx) => upsertFxRateInternal(tx, input));
}
