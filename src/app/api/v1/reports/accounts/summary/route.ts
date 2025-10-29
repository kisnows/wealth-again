import { type NextRequest, NextResponse } from "next/server";
import { computeAccountsSummary } from "@/server/services/accounts-ledger/accounts";
import { getUserFromRequest } from "@/server/utils/auth";

/**
 * GET /api/v1/reports/accounts/summary?displayCurrency=CNY
 * - 返回账户层面的本金/估值/收益等汇总（账户币种 + 展示币种折算）。
 * - 返回: 501 TODO（占位），后续返回 Array<AccountSummary>
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const displayCurrency = searchParams.get("displayCurrency") || undefined;
  const user = await getUserFromRequest(req);
  if (!user || typeof user.id !== "string")
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const summary = await computeAccountsSummary({
    userId: user.id,
    displayCurrency,
  });
  return NextResponse.json(summary);
}
