import type { FxRate, Prisma } from "@prisma/client";
import prisma from "@/server/db";

const END_OF_TIME = new Date("9999-12-31T23:59:59.999Z");

type NumericLike = number | { toNumber: () => number };

type FxRateClient = {
  findFirst: (args: unknown) => Promise<FxRate | null>;
  findMany: (args: unknown) => Promise<FxRate[]>;
  create: (args: unknown) => Promise<FxRate>;
  update: (args: unknown) => Promise<FxRate>;
  updateMany: (args: unknown) => Promise<{ count: number }>;
  delete: (args: unknown) => Promise<FxRate>;
};

const toNumber = (value: NumericLike) =>
  typeof value === "number" ? value : value.toNumber();

export type UpsertFxRateInput = {
  base: string;
  quote: string;
  rate: number;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  tx?: Prisma.TransactionClient;
};

export class FxRateOverlapError extends Error {
  constructor() {
    super("overlapping interval");
    this.name = "FxRateOverlapError";
  }
}

async function upsertFxRateInternal(
  tx: Prisma.TransactionClient,
  input: UpsertFxRateInput,
): Promise<FxRate> {
  const scopedFxClient = tx.fxRate as unknown as FxRateClient;
  const normalizedBase = input.base.toUpperCase();
  const normalizedQuote = input.quote.toUpperCase();
  const fromDate = new Date(input.effectiveFrom);
  const toDate = input.effectiveTo ?? null;
  const newEnd = toDate ?? END_OF_TIME;

  const existingSameStart = await scopedFxClient.findFirst({
    where: {
      base: normalizedBase,
      quote: normalizedQuote,
      effectiveFrom: fromDate,
    },
  });

  const overlapping = await scopedFxClient.findMany({
    where: {
      base: normalizedBase,
      quote: normalizedQuote,
      effectiveFrom: { lt: newEnd },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: fromDate } }],
    },
    orderBy: { effectiveFrom: "asc" },
  });

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
      await scopedFxClient.update({
        where: { id: record.id },
        data: { effectiveTo: fromDate },
      });

      if (recordEnd > newEnd && newEnd !== END_OF_TIME) {
        await scopedFxClient.create({
          data: {
            base: normalizedBase,
            quote: normalizedQuote,
            rate: toNumber(record.rate as NumericLike),
            effectiveFrom: newEnd,
            effectiveTo: record.effectiveTo,
          },
        });
      }
    } else {
      if (recordEnd > newEnd && newEnd !== END_OF_TIME) {
        await scopedFxClient.update({
          where: { id: record.id },
          data: { effectiveFrom: newEnd },
        });
      } else {
        await scopedFxClient.delete({
          where: { id: record.id },
        });
      }
    }
  }

  let result: FxRate;
  if (existingSameStart) {
    result = await scopedFxClient.update({
      where: { id: existingSameStart.id },
      data: {
        rate: input.rate,
        effectiveTo: toDate,
      },
    });
  } else {
    result = await scopedFxClient.create({
      data: {
        base: normalizedBase,
        quote: normalizedQuote,
        rate: input.rate,
        effectiveFrom: fromDate,
        effectiveTo: toDate,
      },
    });
  }

  const overlappingAfter = await scopedFxClient.findFirst({
    where: {
      base: normalizedBase,
      quote: normalizedQuote,
      id: { not: result.id },
      effectiveFrom: { lt: result.effectiveTo ?? END_OF_TIME },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gt: result.effectiveFrom } },
      ],
    },
  });
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
  return prisma.$transaction(async (tx) => upsertFxRateInternal(tx, input));
}
