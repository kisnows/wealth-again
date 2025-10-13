import prisma from "@/server/db";

export async function getFxRate(params: {
  base: string;
  quote: string;
  asOf?: Date;
}) {
  const base = params.base;
  const quote = params.quote;
  const on = params.asOf;
  if (!on) {
    return prisma.fxRate.findFirst({
      where: { base, quote },
      orderBy: { asOf: "desc" },
    });
  }
  const first = await prisma.fxRate.findFirst({
    where: { base, quote, asOf: { lte: on } },
    orderBy: { asOf: "desc" },
  });
  if (first) return first;
  return prisma.fxRate.findFirst({ where: { base, quote, asOf: on } });
}

export async function getLatestRates(base: string, quotes: string[]) {
  if (quotes.length === 0) return [];
  const upperQuotes = Array.from(
    new Set(quotes.map((quote) => quote.toUpperCase())),
  );
  const rows = await prisma.fxRate.findMany({
    where: {
      base,
      quote: { in: upperQuotes },
    },
    orderBy: { asOf: "desc" },
  });
  const latest = new Map<string, { rate: number; asOf: Date }>();
  rows.forEach((row) => {
    const quote = row.quote.toUpperCase();
    if (!latest.has(quote)) {
      latest.set(quote, { rate: Number(row.rate), asOf: row.asOf });
    }
  });
  return upperQuotes.map((quote) => {
    const found = latest.get(quote);
    return {
      quote,
      rate: found ? found.rate : null,
      asOf: found?.asOf ?? null,
    };
  });
}

type FxSnapshot = {
  id?: string;
  base: string;
  quote: string;
  rate: number;
  asOf: Date;
};

export async function convert(
  amount: number,
  from: string,
  to: string,
  asOf?: Date,
): Promise<{
  amount: number;
  effectiveRate: number;
  snapshots: FxSnapshot[];
}> {
  if (from === to)
    return { amount, effectiveRate: 1, snapshots: [] };
  // 通过 USD 中间价折算
  if (from === "USD") {
    const r = await getFxRate({ base: "USD", quote: to, asOf });
    if (!r) throw new Error("rate missing");
    const rate = Number(r.rate);
    return {
      amount: amount * rate,
      effectiveRate: rate,
      snapshots: [{ id: r.id, base: "USD", quote: to, rate, asOf: r.asOf }],
    };
  }
  if (to === "USD") {
    const r = await getFxRate({ base: "USD", quote: from, asOf });
    if (!r) throw new Error("rate missing");
    const rate = Number(r.rate);
    const converted = amount / rate;
    return {
      amount: converted,
      effectiveRate: converted / amount,
      snapshots: [{ id: r.id, base: "USD", quote: from, rate, asOf: r.asOf }],
    };
  }
  const rFrom = await getFxRate({ base: "USD", quote: from, asOf });
  const rTo = await getFxRate({ base: "USD", quote: to, asOf });
  if (!rFrom || !rTo) throw new Error("rate missing");
  const rateFrom = Number(rFrom.rate);
  const rateTo = Number(rTo.rate);
  const usd = amount / rateFrom;
  const converted = usd * rateTo;
  return {
    amount: converted,
    effectiveRate: converted / amount,
    snapshots: [
      { id: rFrom.id, base: "USD", quote: from, rate: rateFrom, asOf: rFrom.asOf },
      { id: rTo.id, base: "USD", quote: to, rate: rateTo, asOf: rTo.asOf },
    ],
  };
}
