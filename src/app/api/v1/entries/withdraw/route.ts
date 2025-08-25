import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";

export async function POST(req: NextRequest) {
  const { accountId, amount, occurredAt, note } = await req.json();
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  const entry = await prisma.txnEntry.create({
    data: {
      userId: account.userId,
      type: "WITHDRAW",
      occurredAt: new Date(occurredAt),
      note,
      lines: {
        create: {
          accountId,
          amount: -Math.abs(amount),
          currency: account.baseCurrency,
          note,
        },
      },
    },
    include: { lines: true },
  });
  return NextResponse.json(entry, { status: 201 });
}
