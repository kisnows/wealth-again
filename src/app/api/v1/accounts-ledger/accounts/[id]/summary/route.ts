import { type NextRequest, NextResponse } from "next/server";
import { computeAccountSummaryById } from "@/server/services/accounts-ledger/accounts";
import { getUserFromRequest } from "@/server/utils/auth";

/**
 * GET /api/v1/accounts-ledger/accounts/:id/summary
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
  const summary = await computeAccountSummaryById({
    accountId: id,
    userId: user.id,
  });
  if (!summary) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }
  return NextResponse.json(summary);
}
