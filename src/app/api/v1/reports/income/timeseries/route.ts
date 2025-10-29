import { type NextRequest, NextResponse } from "next/server";
import type { IncomeRecordsSummary } from "@/server/services/income-tax/income";
import { ensureIncomeRecordsForUser } from "@/server/services/income-tax/income";
import { buildIncomeTimeline } from "@/server/services/income-tax/income-timeline";
import { getUserFromRequest } from "@/server/utils/auth";

/**
 * GET /api/v1/reports/income/timeseries?from=YYYY-MM-01&to=YYYY-MM-01
 * - 返回工资/奖金/长期现金/股权/社保/公积金/个税/税后各曲线。
 * - 返回: 501 TODO（占位），后续返回 { series: Record<string, Array<{ month: string, value: number }>> }
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const displayCurrency = searchParams.get("displayCurrency");
  if (!from || !to)
    return NextResponse.json({ error: "from & to required" }, { status: 400 });
  const user = await getUserFromRequest(req);
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = user.id;
  await ensureIncomeRecordsForUser(userId);
  const timeline = await buildIncomeTimeline(
    userId,
    from,
    to,
    displayCurrency ?? undefined,
  );
  const actualItems = timeline.items.filter((item) => !item.isForecast);

  const series = {
    gross: actualItems.map((item) => ({
      month: item.monthDate,
      value: item.gross,
    })),
    bonus: actualItems.map((item) => ({
      month: item.monthDate,
      value: item.bonus,
    })),
    ltcIncome: actualItems.map((item) => ({
      month: item.monthDate,
      value: item.ltcIncome,
    })),
    equityIncome: actualItems.map((item) => ({
      month: item.monthDate,
      value: item.equityIncome,
    })),
    socialInsurance: actualItems.map((item) => ({
      month: item.monthDate,
      value: item.socialInsurance,
    })),
    housingFund: actualItems.map((item) => ({
      month: item.monthDate,
      value: item.housingFund,
    })),
    incomeTax: actualItems.map((item) => ({
      month: item.monthDate,
      value: item.incomeTax,
    })),
    netIncome: actualItems.map((item) => ({
      month: item.monthDate,
      value: item.netIncome,
    })),
  };

  const totalsActual = timeline.summary.totals.actual;
  const totalIncome =
    totalsActual.gross +
    totalsActual.bonus +
    totalsActual.ltcIncome +
    totalsActual.equityIncome;
  const totalSpecialDeductions = actualItems.reduce(
    (acc, item) => acc + item.specialDeductions,
    0,
  );
  const latestActual = actualItems[actualItems.length - 1] ?? null;

  const summary: IncomeRecordsSummary = {
    months: actualItems.length,
    currency: timeline.summary.currency,
    totalGross: totalsActual.gross,
    totalBonus: totalsActual.bonus,
    totalLtc: totalsActual.ltcIncome,
    totalEquity: totalsActual.equityIncome,
    totalSocialInsurance: totalsActual.socialInsurance,
    totalHousingFund: totalsActual.housingFund,
    totalSpecialDeductions,
    totalTax: totalsActual.incomeTax,
    totalNet: totalsActual.netIncome,
    totalIncome,
    avgTaxRate: totalIncome > 0 ? (totalsActual.incomeTax / totalIncome) * 100 : 0,
    latestTaxPaid: latestActual?.incomeTax ?? 0,
    latestTaxCumulative: latestActual?.taxPaidCumulative ?? 0,
  };

  return NextResponse.json({ series, summary });
}
