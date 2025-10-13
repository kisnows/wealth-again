import { NextResponse, type NextRequest } from "next/server";
import { getLatestRates } from "@/server/services/fx";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const quotesParam = searchParams.get("quotes");
  if (!quotesParam) {
    return NextResponse.json({ error: "quotes is required" }, { status: 400 });
  }
  const quotes = quotesParam
    .split(",")
    .map((quote) => quote.trim().toUpperCase())
    .filter((quote) => quote.length > 0);
  if (quotes.length === 0) {
    return NextResponse.json({ base: "USD", items: [] });
  }
  const items = await getLatestRates("USD", quotes);
  return NextResponse.json({
    base: "USD",
    items: items.map((item) => ({
      quote: item.quote,
      rate: item.rate,
      asOf: item.asOf ? item.asOf.toISOString() : null,
    })),
  });
}
