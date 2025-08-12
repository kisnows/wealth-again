import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  amount: z.number().positive(),
  date: z.string(),
  currency: z.string().default("CNY"),
});

export async function POST(req: NextRequest) {
  const body = schema.parse(await req.json());
  const date = new Date(body.date);
  const amount = body.amount;
  const [outTx, inTx] = await prisma.$transaction([
    prisma.transaction.create({
      data: {
        accountId: body.fromAccountId,
        type: "TRANSFER_OUT",
        tradeDate: date,
        cashAmount: amount.toString(),
        currency: body.currency,
      },
    }),
    prisma.transaction.create({
      data: {
        accountId: body.toAccountId,
        type: "TRANSFER_IN",
        tradeDate: date,
        cashAmount: amount.toString(),
        currency: body.currency,
      },
    }),
  ]);
  return NextResponse.json({ fromId: outTx.id, toId: inTx.id });
}
