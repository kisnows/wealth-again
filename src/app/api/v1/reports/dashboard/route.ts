import { type NextRequest, NextResponse } from "next/server";
import { computeAccountsSummary } from "@/server/services/accounts-summary";
import { getUserFromRequest } from "@/server/utils/auth";

/**
 * GET /api/v1/reports/dashboard?asOf=YYYY-MM-DD&displayCurrency=CNY
 * - 返回总资产/负债/净资产与近 12 个月净资产曲线、资产占比。
 * - 返回: 501 TODO（占位），后续返回 { totals, timeseries, allocations }
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
  return NextResponse.json({
    totals: summary.totals,
    displayCurrency: summary.displayCurrency,
    allocations: [],
    timeseries: [],
  });
}
