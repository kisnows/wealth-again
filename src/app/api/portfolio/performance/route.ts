import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  computePerformance,
  computePerformanceSeries,
} from "@/lib/performance";

export async function GET() {
  const snaps = await prisma.valuationSnapshot.findMany({
    orderBy: { asOf: "asc" },
  });
  const txs = await prisma.transaction.findMany();
  // aggregate snapshots by date
  const map = new Map<number, number>();
  for (const s of snaps) {
    const k = s.asOf.getTime();
    map.set(k, (map.get(k) || 0) + Number(s.totalValue));
  }
  const valuations = [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, v]) => ({ date: new Date(t), value: v }));
  const flows = txs
    .filter((t) => ["CASH_IN", "CASH_OUT"].includes(t.type))
    .map((t) => ({
      date: t.tradeDate,
      amount: Number(t.cashAmount || 0) * (t.type === "CASH_IN" ? 1 : -1),
    }));
  const perf = computePerformance(valuations, flows);
  const series = computePerformanceSeries(valuations, flows);
  return NextResponse.json({ performance: perf, series });
}
