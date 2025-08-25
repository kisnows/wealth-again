import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";

export async function POST(req: NextRequest) {
  const { from, to, occurredAt, note } = await req.json();
  const fromAccount = await prisma.account.findUnique({
    where: { id: from.accountId },
  });
  const toAccount = await prisma.account.findUnique({
    where: { id: to.accountId },
  });
  if (!fromAccount || !toAccount) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  const entry = await prisma.txnEntry.create({
    data: {
      userId: fromAccount.userId,
      type: "TRANSFER",
      occurredAt: new Date(occurredAt),
      note,
      lines: {
        create: [
          {
            accountId: from.accountId,
            amount: -Math.abs(from.amount),
            currency: fromAccount.baseCurrency,
            note,
          },
          {
            accountId: to.accountId,
            amount: Math.abs(to.amount ?? from.amount),
            currency: toAccount.baseCurrency,
            note,
          },
        ],
      },
    },
    include: { lines: true },
  });
  return NextResponse.json(entry, { status: 201 });
}
