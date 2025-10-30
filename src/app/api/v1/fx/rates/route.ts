import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/server/db";
import { logAudit } from "@/server/services/audit";
import { getUserFromRequest } from "@/server/utils/auth";
import {
  ensureIdempotent,
  markIdempotencyUsed,
} from "@/server/utils/idempotency";

const END_OF_TIME = new Date("9999-12-31T23:59:59.999Z");

type FxRateRecord = {
  id: string;
  base: string;
  quote: string;
  rate: number | { toNumber: () => number };
  effectiveFrom: Date;
  effectiveTo: Date | null;
  createdAt: Date;
};

type FxRateClient = {
  findFirst: (args: unknown) => Promise<FxRateRecord | null>;
  findMany: (args: unknown) => Promise<FxRateRecord[]>;
  create: (args: unknown) => Promise<FxRateRecord>;
  update: (args: unknown) => Promise<FxRateRecord>;
  updateMany: (args: unknown) => Promise<unknown>;
};

const fxRateClient = prisma.fxRate as unknown as FxRateClient;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const base = (searchParams.get("base") ?? "USD").toUpperCase();
  const quote = searchParams.get("quote")?.toUpperCase();
  const on = searchParams.get("on");
  if (!quote) {
    return NextResponse.json({ error: "quote is required" }, { status: 400 });
  }
  if (on) {
    const onDate = new Date(on);
    if (Number.isNaN(onDate.getTime())) {
      return NextResponse.json({ error: "invalid on" }, { status: 400 });
    }
    const rec = await fxRateClient.findFirst({
      where: {
        base,
        quote,
        effectiveFrom: { lte: onDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: onDate } }],
      },
      orderBy: { effectiveFrom: "desc" },
    });
    if (!rec) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }
    return NextResponse.json(rec);
  }
  const now = new Date();
  const rate = await fxRateClient.findFirst({
    where: {
      base,
      quote,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
  if (!rate) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }
  return NextResponse.json(rate);
}

type CreateFxRatePayload = {
  base: string;
  quote: string;
  rate: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
};

class FxRateOverlapError extends Error {
  constructor() {
    super("overlapping interval");
    this.name = "FxRateOverlapError";
  }
}

const toNumber = (value: number | { toNumber: () => number }) =>
  typeof value === "number" ? value : value.toNumber();

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { base, quote, rate, effectiveFrom, effectiveTo } =
    (await req.json()) as CreateFxRatePayload;
  if (!base || !quote || typeof rate !== "number" || !effectiveFrom) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (rate <= 0) {
    return NextResponse.json({ error: "rate must be > 0" }, { status: 400 });
  }
  const normalizedBase = base.toUpperCase();
  const normalizedQuote = quote.toUpperCase();
  if (normalizedBase !== "USD") {
    return NextResponse.json({ error: "base must be USD" }, { status: 400 });
  }
  if (normalizedBase === normalizedQuote) {
    return NextResponse.json(
      { error: "quote must differ from base" },
      { status: 400 },
    );
  }
  const fromDate = new Date(effectiveFrom);
  if (Number.isNaN(fromDate.getTime())) {
    return NextResponse.json(
      { error: "invalid effectiveFrom" },
      { status: 400 },
    );
  }
  const toDate = effectiveTo ? new Date(effectiveTo) : null;
  if (toDate && Number.isNaN(toDate.getTime())) {
    return NextResponse.json({ error: "invalid effectiveTo" }, { status: 400 });
  }
  if (toDate && toDate <= fromDate) {
    return NextResponse.json(
      { error: "effectiveTo must be later than effectiveFrom" },
      { status: 400 },
    );
  }

  const idempotencyFingerprint = `${normalizedBase}:${normalizedQuote}:${fromDate.toISOString()}:${
    toDate?.toISOString() ?? "open"
  }:${rate}`;
  const { key, existed } = await ensureIdempotent(
    req,
    user.id,
    idempotencyFingerprint,
  );
  if (existed) {
    return NextResponse.json(
      { error: "Idempotency key reused" },
      { status: 409 },
    );
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const scopedFxClient = tx.fxRate as unknown as FxRateClient;

      const existingSameStart = await scopedFxClient.findFirst({
        where: {
          base: normalizedBase,
          quote: normalizedQuote,
          effectiveFrom: fromDate,
        },
      });
      if (existingSameStart) {
        return scopedFxClient.update({
          where: { id: existingSameStart.id },
          data: {
            rate,
            effectiveTo: toDate,
          },
        });
      }

      await scopedFxClient.updateMany({
        where: {
          base: normalizedBase,
          quote: normalizedQuote,
          effectiveTo: null,
          effectiveFrom: { lt: fromDate },
        },
        data: { effectiveTo: fromDate },
      });

      const overlapping = await scopedFxClient.findFirst({
        where: {
          base: normalizedBase,
          quote: normalizedQuote,
          effectiveFrom: { lt: toDate ?? END_OF_TIME },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: fromDate } }],
        },
      });

      if (overlapping) {
        throw new FxRateOverlapError();
      }

      return scopedFxClient.create({
        data: {
          base: normalizedBase,
          quote: normalizedQuote,
          rate,
          effectiveFrom: fromDate,
          effectiveTo: toDate,
        },
      });
    });

    await logAudit("FX_RATE_CREATE", {
      userId: user.id,
      meta: {
        fxRateId: created.id,
        base: normalizedBase,
        quote: normalizedQuote,
        rate: toNumber(created.rate),
        effectiveFrom: created.effectiveFrom.toISOString(),
        effectiveTo: created.effectiveTo
          ? created.effectiveTo.toISOString()
          : null,
      },
    });
    await markIdempotencyUsed(key);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof FxRateOverlapError) {
      return NextResponse.json(
        { error: "overlapping interval" },
        { status: 409 },
      );
    }
    throw error;
  }
}
