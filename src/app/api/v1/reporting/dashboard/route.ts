import { type NextRequest, NextResponse } from "next/server";
import { computeAccountsSummary } from "@/server/services/accounts-ledger/accounts";
import { getReportDataset } from "@/server/services/reporting/dataset";
import { refreshAccountsSummaryDataset } from "@/server/services/reporting/updaters";
import { getUserFromRequest } from "@/server/utils/auth";

/**
 * GET /api/v1/reporting/dashboard?asOf=YYYY-MM-DD&displayCurrency=CNY
 * - 返回总资产/负债/净资产与近 12 个月净资产曲线、资产占比。
 * - 返回: 501 TODO（占位），后续返回 { totals, timeseries, allocations }
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const displayCurrency = searchParams.get("displayCurrency") || undefined;
  const user = await getUserFromRequest(req);
  if (!user || typeof user.id !== "string")
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const normalizedDisplay = displayCurrency
    ? displayCurrency.toUpperCase()
    : null;
  if (!normalizedDisplay) {
    const dataset = await getReportDataset(user.id, "dashboard.overview");
    if (dataset?.payload) {
      const payload = dataset.payload as Record<string, unknown>;
      return NextResponse.json({
        totals: payload.totals ?? { assets: 0, liabilities: 0, netWorth: 0, archived: 0 },
        displayCurrency: payload.displayCurrency ?? null,
        allocations: payload.allocations ?? [],
        timeseries: payload.timeseries ?? [],
        generatedAt: payload.generatedAt ?? dataset.updatedAt.toISOString(),
        accountCount: payload.accountCount ?? 0,
      });
    }
    const { summary, generatedAt } = await refreshAccountsSummaryDataset(user.id);
    return NextResponse.json({
      totals: summary.totals,
      displayCurrency: summary.displayCurrency,
      allocations: [],
      timeseries: [],
      generatedAt: generatedAt.toISOString(),
      accountCount: summary.items.length,
    });
  }
  const summary = await computeAccountsSummary({
    userId: user.id,
    displayCurrency: normalizedDisplay,
  });
  return NextResponse.json({
    totals: summary.totals,
    displayCurrency: summary.displayCurrency,
    allocations: [],
    timeseries: [],
  });
}
