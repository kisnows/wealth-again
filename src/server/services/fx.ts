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

export async function convert(
  amount: number,
  from: string,
  to: string,
  asOf: Date,
) {
  if (from === to) return amount;
  // 通过 USD 中间价折算
  if (from === "USD") {
    const r = await getFxRate({ base: "USD", quote: to, asOf });
    if (!r) throw new Error("rate missing");
    return amount * Number(r.rate);
  }
  if (to === "USD") {
    const r = await getFxRate({ base: "USD", quote: from, asOf });
    if (!r) throw new Error("rate missing");
    return amount / Number(r.rate);
  }
  const rFrom = await getFxRate({ base: "USD", quote: from, asOf });
  const rTo = await getFxRate({ base: "USD", quote: to, asOf });
  if (!rFrom || !rTo) throw new Error("rate missing");
  const usd = amount / Number(rFrom.rate);
  return usd * Number(rTo.rate);
}
