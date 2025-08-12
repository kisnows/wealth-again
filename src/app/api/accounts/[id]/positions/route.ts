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
  // FIFO lots in-memory
  const lots = new Map<
    string,
    {
      qty: number;
      costPerUnit: number;
      layers: { qty: number; price: number }[];
    }
  >();
  for (const t of txs) {
    if (!t.instrumentId) continue;
    const q = Number(t.quantity || 0);
    const p = Number(t.price || 0);
    const fee = Number(t.fee || 0) + Number(t.tax || 0);
    const key = t.instrumentId;
    if (!lots.has(key)) lots.set(key, { qty: 0, costPerUnit: 0, layers: [] });
    const bucket = lots.get(key)!;
    if (t.type === "BUY") {
      bucket.layers.push({ qty: q, price: p });
      bucket.qty += q;
      // recompute avg cost including fees allocated to this trade
      const totalCost =
        bucket.layers.reduce((s, l) => s + l.qty * l.price, 0) + fee;
      const totalQty = bucket.layers.reduce((s, l) => s + l.qty, 0);
      bucket.costPerUnit = totalQty ? totalCost / totalQty : 0;
    } else if (t.type === "SELL") {
      let remaining = q;
      while (remaining > 0 && bucket.layers.length > 0) {
        const layer = bucket.layers[0];
        const used = Math.min(layer.qty, remaining);
        layer.qty -= used;
        remaining -= used;
        bucket.qty -= used;
        if (layer.qty === 0) bucket.layers.shift();
      }
      const totalCost = bucket.layers.reduce((s, l) => s + l.qty * l.price, 0);
      const totalQty = bucket.layers.reduce((s, l) => s + l.qty, 0);
      bucket.costPerUnit = totalQty ? totalCost / totalQty : 0;
    }
  }
  const entries = [...lots.entries()].filter(([, v]) => v.qty > 0);
  const ids = entries.map(([instrumentId]) => instrumentId);
  const instruments = ids.length
    ? await prisma.instrument.findMany({ where: { id: { in: ids } } })
    : [];
  const idToSymbol = new Map(instruments.map((i) => [i.id, i.symbol] as const));
  const positions = entries.map(([instrumentId, v]) => ({
    instrumentId,
    symbol: idToSymbol.get(instrumentId) || instrumentId,
    qty: v.qty,
    avgCost: v.costPerUnit,
  }));
  return NextResponse.json({ positions });
}
