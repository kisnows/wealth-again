import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  accountId: z.string().uuid(),
  type: z.string(),
  tradeDate: z.string(),
  instrumentSymbol: z.string().optional(),
  quantity: z.number().optional(),
  price: z.number().optional(),
  cashAmount: z.number().optional(),
  currency: z.string(),
  fee: z.number().optional(),
  tax: z.number().optional(),
  note: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = schema.parse(await req.json());
  let instrumentId: string | undefined;
  if (body.instrumentSymbol) {
    const inst = await prisma.instrument.upsert({
      where: { symbol: body.instrumentSymbol },
      create: { symbol: body.instrumentSymbol },
      update: {},
    });
    instrumentId = inst.id;
  }
  const rec = await prisma.transaction.create({
    data: {
      accountId: body.accountId,
      type: body.type as any,
      tradeDate: new Date(body.tradeDate),
      instrumentId,
      quantity: body.quantity?.toString(),
      price: body.price?.toString(),
      cashAmount: body.cashAmount?.toString(),
      currency: body.currency,
      fee: body.fee?.toString(),
      tax: body.tax?.toString(),
      note: body.note,
    },
  });
  return NextResponse.json({ id: rec.id });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId");
  const type = searchParams.get("type");
  const page = Number(searchParams.get("page") || "1");
  const pageSize = Number(searchParams.get("pageSize") || "50");
  const skip = (page - 1) * pageSize;
  const where: any = {};
  if (accountId) where.accountId = accountId;
  if (type) where.type = type;
  const [total, txs] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: { tradeDate: "desc" },
      skip,
      take: pageSize,
    }),
  ]);
  return NextResponse.json({ transactions: txs, total, page, pageSize });
}
