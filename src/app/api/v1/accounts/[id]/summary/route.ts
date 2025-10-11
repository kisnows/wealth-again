import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import { getUserFromRequest } from "@/server/utils/auth";

/**
 * GET /api/v1/accounts/:id/summary
 * - 计算账户本金/估值/收益/ROI（账户币种）。
 * - 返回: { id, name, currency, principal, valuation, profit, roi }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const user = await getUserFromRequest(req);
  if (!user || typeof user.id !== "string")
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const account = await prisma.account.findUnique({
    where: { id },
    include: {
      txnLines: true,
      valuations: { orderBy: { asOf: "desc" }, take: 1 },
    },
  });
  if (!account || account.userId !== user.id) {
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
