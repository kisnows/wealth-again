import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const account = await prisma.account.findUnique({
    where: { id: params.id },
    include: {
      txnLines: true,
      valuations: { orderBy: { asOf: "desc" }, take: 1 },
    },
  });
  if (!account) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }
  const principal = account.txnLines.reduce(
    (sum, line) => sum + Number(line.amount),
    Number(account.initialBalance),
  );
  const valuation =
    account.accountType === "SAVINGS"
      ? principal
      : (account.valuations[0]?.totalValue.toNumber() ?? 0);
  const profit = valuation - principal;
  const roi = principal === 0 ? null : profit / principal;
  return NextResponse.json({
    id: account.id,
    name: account.name,
    currency: account.baseCurrency,
    principal,
    valuation,
    profit,
    roi,
  });
}
