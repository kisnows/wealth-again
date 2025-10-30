import { type NextRequest, NextResponse } from "next/server";
import { computeAccountsSummary } from "@/server/services/accounts-ledger/accounts";
import { getReportDataset } from "@/server/services/reporting/dataset";
import { refreshAccountsSummaryDataset } from "@/server/services/reporting/updaters";
import { getUserFromRequest } from "@/server/utils/auth";

/**
 * GET /api/v1/reporting/accounts/summary?displayCurrency=CNY
 * - 返回账户层面的本金/估值/收益等汇总（账户币种 + 展示币种折算）。
 * - 返回: 501 TODO（占位），后续返回 Array<AccountSummary>
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
    const dataset = await getReportDataset(user.id, "accounts.summary");
    if (dataset?.payload) {
      return NextResponse.json(dataset.payload);
    }
    const { payload } = await refreshAccountsSummaryDataset(user.id);
    return NextResponse.json(payload);
  }
  const summary = await computeAccountsSummary({
    userId: user.id,
    displayCurrency: normalizedDisplay,
  });
  return NextResponse.json(summary);
}
