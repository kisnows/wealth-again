import { type NextRequest, NextResponse } from "next/server";
import { computeAccountsSummary } from "@/server/services/accounts-ledger/accounts";
import { getReportDataset } from "@/server/services/reporting/dataset";
import {
  buildAllocations,
  refreshAccountsSummaryDataset,
} from "@/server/services/reporting/updaters";
import { buildNetWorthTrend } from "@/server/services/reporting/netWorth";
import { getUserFromRequest } from "@/server/utils/auth";

/**
 * GET /api/v1/reporting/dashboard?asOf=YYYY-MM-DD&displayCurrency=CNY
 * - 返回总资产/负债/净资产与近 12 个月净资产曲线、资产占比。
 * - 返回: { totals, netWorthTrend, allocations }
 */

function parseAsOfParam(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCHours(23, 59, 59, 999);
  return parsed;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const displayCurrency = searchParams.get("displayCurrency") || undefined;
  const asOfParam = searchParams.get("asOf");
  const asOfDate = parseAsOfParam(asOfParam);
  const user = await getUserFromRequest(req);
  if (!user || typeof user.id !== "string")
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const normalizedDisplay = displayCurrency
    ? displayCurrency.toUpperCase()
    : null;
  const shouldUseDataset = !normalizedDisplay && !asOfDate;
  if (shouldUseDataset) {
    const dataset = await getReportDataset(user.id, "dashboard.overview");
    if (dataset?.payload) {
      const payload = dataset.payload as Record<string, unknown>;
      if (Array.isArray(payload.netWorthTrend)) {
        return NextResponse.json({
          totals: payload.totals ?? { assets: 0, liabilities: 0, netWorth: 0, archived: 0 },
          displayCurrency: payload.displayCurrency ?? null,
          allocations: payload.allocations ?? [],
          netWorthTrend: payload.netWorthTrend,
          generatedAt: payload.generatedAt ?? dataset.updatedAt.toISOString(),
          accountCount: payload.accountCount ?? 0,
        });
      }
    }
    const { summary, generatedAt, dashboardPayload } =
      await refreshAccountsSummaryDataset(user.id);
    return NextResponse.json({
      totals: summary.totals,
      displayCurrency: summary.displayCurrency,
      allocations: dashboardPayload.allocations,
      netWorthTrend: dashboardPayload.netWorthTrend,
      generatedAt: generatedAt.toISOString(),
      accountCount: summary.items.length,
    });
  }
  const summary = await computeAccountsSummary({
    userId: user.id,
    displayCurrency: normalizedDisplay,
    asOf: asOfDate ?? undefined,
  });
  const netWorthTrend = await buildNetWorthTrend({
    userId: user.id,
    displayCurrency: normalizedDisplay ?? summary.displayCurrency,
    asOf: asOfDate ?? undefined,
  });
  return NextResponse.json({
    totals: summary.totals,
    displayCurrency: summary.displayCurrency,
    allocations: buildAllocations(summary.items),
    netWorthTrend,
    generatedAt: (asOfDate ?? new Date()).toISOString(),
    accountCount: summary.items.length,
  });
}
