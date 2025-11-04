import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { refreshLatestFxRate } from "@/server/services/fx/update";
import { getUserFromRequest } from "@/server/utils/auth";
import {
  ensureIdempotent,
  markIdempotencyUsed,
} from "@/server/utils/idempotency";

type RefreshPayload = {
  quote: string;
};

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: RefreshPayload;
  try {
    payload = (await req.json()) as RefreshPayload;
  } catch (_error) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const quote = payload.quote?.toUpperCase();
  if (!quote) {
    return NextResponse.json({ error: "quote_required" }, { status: 400 });
  }

  const { key, existed } = await ensureIdempotent(
    req,
    user.id,
    `${user.id}:${quote}:refresh_latest`,
  );
  if (existed) {
    return NextResponse.json({ error: "idempotent_conflict" }, { status: 409 });
  }

  try {
    const record = await refreshLatestFxRate({
      quote,
      triggeredBy: user.id,
    });
    await markIdempotencyUsed(key);
    return NextResponse.json({
      id: record.id,
      base: record.base,
      quote: record.quote,
      rate: Number(record.rate),
      effectiveFrom: record.effectiveFrom.toISOString(),
      effectiveTo: record.effectiveTo ? record.effectiveTo.toISOString() : null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "fx_refresh_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
