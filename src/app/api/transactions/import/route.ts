import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const payloadSchema = z.object({
  accountId: z.string().uuid(),
  csv: z.string(),
  delimiter: z.string().length(1).default(","),
  mapping: z.record(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const body = payloadSchema.parse(await req.json());
  const lines = body.csv
    .split(/\r?\n/)
    .filter((l: string) => l.trim().length > 0);
  if (lines.length < 2)
    return NextResponse.json({ error: "no data" }, { status: 400 });
  const headers = lines[0].split(body.delimiter).map((h: string) => h.trim());
  const map = body.mapping || {
    date: "date",
    type: "type",
    symbol: "symbol",
    quantity: "quantity",
    price: "price",
    cash: "cash",
    currency: "currency",
    fee: "fee",
    tax: "tax",
  };
  const headerIndex: Record<string, number> = {};
  for (const [k, v] of Object.entries(map)) {
    const idx = headers.findIndex(
      (h: string) => h.toLowerCase() === String(v).toLowerCase()
    );
    if (idx >= 0) headerIndex[k] = idx;
  }
  const created: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(body.delimiter);
    if (cols.length !== headers.length) continue;
    try {
      const type = cols[headerIndex["type"]];
      const tradeDate = new Date(cols[headerIndex["date"]]);
      const symbol =
        headerIndex["symbol"] != null ? cols[headerIndex["symbol"]] : undefined;
      const quantity =
        headerIndex["quantity"] != null
          ? Number(cols[headerIndex["quantity"]])
          : undefined;
      const price =
        headerIndex["price"] != null
          ? Number(cols[headerIndex["price"]])
          : undefined;
      const cashAmount =
        headerIndex["cash"] != null
          ? Number(cols[headerIndex["cash"]])
          : undefined;
      const currency =
        headerIndex["currency"] != null ? cols[headerIndex["currency"]] : "CNY";
      const fee =
        headerIndex["fee"] != null ? Number(cols[headerIndex["fee"]]) : 0;
      const tax =
        headerIndex["tax"] != null ? Number(cols[headerIndex["tax"]]) : 0;
      let instrumentId: string | undefined;
      if (symbol) {
        let inst = await prisma.instrument.findFirst({
          where: { symbol },
        });
        if (!inst) {
          inst = await prisma.instrument.create({
            data: { symbol },
          });
        }
        instrumentId = inst.id;
      }
      const rec = await prisma.transaction.create({
        data: {
          accountId: body.accountId,
          type: type as any,
          tradeDate,
          instrumentId,
          quantity: quantity?.toString(),
          price: price?.toString(),
          cashAmount: cashAmount?.toString(),
          currency,
          fee: fee?.toString(),
          tax: tax?.toString(),
        },
      });
      created.push(rec.id);
    } catch (e) {}
  }
  return NextResponse.json({ imported: created.length, ids: created });
}
