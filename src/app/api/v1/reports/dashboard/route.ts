import { type NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/server/utils/auth";
import { computeAccountSummary } from "../accounts/summary/utils";

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
  const items = await computeAccountSummary(displayCurrency, user.id);
  const totals = items.reduce(
    (acc, i) => {
      const v = i.displayValue ?? i.valuation;
      if (i.currency && i.currency.toUpperCase() === "CNY") {
        // no-op special case, keep consistent
      }
      if (i.profit >= 0) {
        acc.assets += v;
      } else {
        // 简化：把负收益账户也计入资产侧，仅做占位结构
        acc.assets += v;
      }
      return acc;
    },
    { assets: 0, liabilities: 0 },
  );
  const netWorth = totals.assets - totals.liabilities;
  return NextResponse.json({
    totals: { ...totals, netWorth },
    displayCurrency: displayCurrency || null,
    allocations: [],
    timeseries: [],
  });
}
