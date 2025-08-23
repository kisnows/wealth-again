import type { PrismaClient } from "@prisma/client";

export async function getRate(
  prisma: PrismaClient,
  params: {
    from: string;
    to: string;
    asOf: Date;
    toleranceDays?: number;
  },
): Promise<number> {
  const { from, to, asOf } = params;
  const toleranceDays = params.toleranceDays ?? 5;
  if (!from || !to) throw new Error("currency_missing");
  if (from === to) return 1;

  const record = await prisma.fxRate.findFirst({
    where: { base: from, quote: to, asOf: { lte: asOf } },
    orderBy: { asOf: "desc" },
  });
  let rate: number | null = record ? Number(record.rate) : null;
  let asOfActual: Date | null = record ? record.asOf : null;

  // 尝试反向汇率
  if (!rate) {
    const rev = await prisma.fxRate.findFirst({
      where: { base: to, quote: from, asOf: { lte: asOf } },
      orderBy: { asOf: "desc" },
    });
    if (rev) {
      rate = 1 / Number(rev.rate);
      asOfActual = rev.asOf;
    }
  }

  if (!rate || !asOfActual) throw new Error("fx_rate_not_found");

  const diffMs = Math.abs(asOf.getTime() - asOfActual.getTime());
  const diffDays = diffMs / (24 * 60 * 60 * 1000);
  if (diffDays > toleranceDays) {
    throw new Error("fx_rate_out_of_tolerance");
  }

  return rate;
}

export async function convert(
  prisma: PrismaClient,
  amount: number,
  from: string,
  to: string,
  asOf: Date,
  toleranceDays?: number,
): Promise<number> {
  if (from === to) return amount;
  const r = await getRate(prisma, { from, to, asOf, toleranceDays });
  return amount * r;
}
