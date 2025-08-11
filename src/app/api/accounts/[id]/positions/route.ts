import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const accountId = params.id;
  const txs = await prisma.transaction.findMany({
    where: { accountId, instrumentId: { not: null } },
    orderBy: { tradeDate: "asc" },
  });
  const map = new Map<
    string,
    { instrumentId: string; qty: number; cost: number }
  >();
  for (const t of txs) {
    if (!t.instrumentId) continue;
    if (!map.has(t.instrumentId))
      map.set(t.instrumentId, {
        instrumentId: t.instrumentId,
        qty: 0,
        cost: 0,
      });
    const entry = map.get(t.instrumentId)!;
    const q = Number(t.quantity || 0);
    const p = Number(t.price || 0);
    if (t.type === "BUY") {
      const newTotalQty = entry.qty + q;
      const newTotalCost =
        entry.cost + q * p + Number(t.fee || 0) + Number(t.tax || 0);
      entry.cost = newTotalCost;
      entry.qty = newTotalQty;
    } else if (t.type === "SELL") {
      entry.qty -= q;
      if (entry.qty < 0) entry.qty = 0;
    }
  }
  const positions = [...map.values()]
    .filter((p) => p.qty !== 0)
    .map((p) => ({ ...p, avgCost: p.qty ? p.cost / p.qty : 0 }));
  return NextResponse.json({ positions });
}
