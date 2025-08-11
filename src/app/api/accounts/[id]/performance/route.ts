import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computePerformance } from "@/lib/performance";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const accountId = params.id;
  const snaps = await prisma.valuationSnapshot.findMany({
    where: { accountId },
    orderBy: { asOf: "asc" },
  });
  const txs = await prisma.transaction.findMany({ where: { accountId } });
  const flows = txs
    .filter((t) => ["CASH_IN", "CASH_OUT"].includes(t.type))
    .map((t) => ({
      date: t.tradeDate,
      amount: Number(t.cashAmount || 0) * (t.type === "CASH_IN" ? 1 : -1),
    }));
  const perf = computePerformance(
    snaps.map((s) => ({ date: s.asOf, value: Number(s.totalValue) })),
    flows
  );
  return NextResponse.json({ performance: perf });
}
