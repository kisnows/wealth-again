import { type NextRequest, NextResponse } from "next/server";
import db from "@/server/db";
import { fxRates } from "@/server/db/schema";
import { and, asc, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const baseParam = (searchParams.get("base") ?? "USD").toUpperCase();
  const quoteParam = searchParams.get("quote");
  if (!quoteParam) {
    return NextResponse.json({ error: "quote is required" }, { status: 400 });
  }
  const normalizedQuote = quoteParam.toUpperCase();
  const items = await db
    .select()
    .from(fxRates)
    .where(and(eq(fxRates.base, baseParam), eq(fxRates.quote, normalizedQuote)))
    .orderBy(asc(fxRates.effectiveFrom));
  return NextResponse.json({
    base: baseParam,
    quote: normalizedQuote,
    items: items.map((item) => ({
      id: item.id,
      rate: Number(item.rate),
      effectiveFrom: item.effectiveFrom.toISOString(),
      effectiveTo: item.effectiveTo ? item.effectiveTo.toISOString() : null,
      createdAt: item.createdAt.toISOString(),
    })),
  });
}
