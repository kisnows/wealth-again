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
