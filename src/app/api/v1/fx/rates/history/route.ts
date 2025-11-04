import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const baseParam = (searchParams.get("base") ?? "USD").toUpperCase();
  const quoteParam = searchParams.get("quote");
  if (!quoteParam) {
    return NextResponse.json({ error: "quote is required" }, { status: 400 });
  }
  const normalizedQuote = quoteParam.toUpperCase();
  const items = await prisma.fxRate.findMany({
    where: {
      base: baseParam,
      quote: normalizedQuote,
    },
    orderBy: { effectiveFrom: "asc" },
  });
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
