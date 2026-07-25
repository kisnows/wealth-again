import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import db from "@/server/db";
import { fxRates } from "@/server/db/schema";
import { logAudit } from "@/server/services/audit";
import { getUserFromRequest } from "@/server/utils/auth";
import {
  ensureIdempotent,
  markIdempotencyUsed,
} from "@/server/utils/idempotency";
import {
  FxRateOverlapError,
  upsertFxRateWithContinuity,
} from "@/server/services/fx/rate-writer";
import { and, desc, eq, gt, isNull, lte, or } from "drizzle-orm";

const END_OF_TIME = new Date("9999-12-31T23:59:59.999Z");

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
    const [rec] = await db
      .select()
      .from(fxRates)
      .where(
        and(
          eq(fxRates.base, base),
          eq(fxRates.quote, quote),
          lte(fxRates.effectiveFrom, onDate),
          or(isNull(fxRates.effectiveTo), gt(fxRates.effectiveTo, onDate)),
        ),
      )
      .orderBy(desc(fxRates.effectiveFrom))
      .limit(1);
    if (!rec) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }
    return NextResponse.json(rec);
  }
  const now = new Date();
  const [rate] = await db
    .select()
    .from(fxRates)
    .where(
      and(
        eq(fxRates.base, base),
        eq(fxRates.quote, quote),
        lte(fxRates.effectiveFrom, now),
        or(isNull(fxRates.effectiveTo), gt(fxRates.effectiveTo, now)),
      ),
    )
    .orderBy(desc(fxRates.effectiveFrom))
    .limit(1);
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

const toNumber = (value: number | string) =>
  typeof value === "number" ? value : Number(value);

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
    const created = await upsertFxRateWithContinuity({
      base: normalizedBase,
      quote: normalizedQuote,
      rate,
      effectiveFrom: fromDate,
      effectiveTo: toDate,
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
