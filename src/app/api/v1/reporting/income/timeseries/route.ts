import { type NextRequest, NextResponse } from "next/server";
import type { IncomeRecordsSummary } from "@/server/services/income-tax/income";
import { ensureIncomeRecordsForUser } from "@/server/services/income-tax/income";
import { buildIncomeTimeline } from "@/server/services/income-tax/income-timeline";
import { getReportDataset } from "@/server/services/reporting/dataset";
import { refreshIncomeReportingDataset } from "@/server/services/reporting/updaters";
import type { IncomeDatasetItem } from "@/server/services/reporting/updaters";
import { getUserFromRequest } from "@/server/utils/auth";

/**
 * GET /api/v1/reporting/income/timeseries?from=YYYY-MM-01&to=YYYY-MM-01
 * - 返回工资/奖金/长期现金/股权/社保/公积金/个税/税后各曲线。
 * - 返回: 501 TODO（占位），后续返回 { series: Record<string, Array<{ month: string, value: number }>> }
 */

type IncomeDatasetSummaryPayload = {
  currency?: string | null;
};

type IncomeDatasetPayload = {
  items?: IncomeDatasetItem[];
  summary?: IncomeDatasetSummaryPayload;
  generatedAt?: string;
};

function isIncomeDatasetItem(value: unknown): value is IncomeDatasetItem {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.monthDate === "string";
}

function isIncomeDatasetPayload(value: unknown): value is IncomeDatasetPayload {
  if (!value || typeof value !== "object") return false;
  const record = value as {
    items?: unknown;
    summary?: unknown;
  };
  if (record.items !== undefined) {
    if (!Array.isArray(record.items)) return false;
    if (!record.items.every(isIncomeDatasetItem)) return false;
  }
  if (record.summary !== undefined) {
    if (!record.summary || typeof record.summary !== "object") return false;
    const currency = (record.summary as { currency?: unknown }).currency;
    if (currency !== undefined && currency !== null && typeof currency !== "string")
      return false;
  }
  return true;
}

function extractCurrency(
  summary: Record<string, unknown> | undefined,
): string | null {
  if (!summary || typeof summary !== "object") return null;
  const currency = (summary as { currency?: unknown }).currency;
  return typeof currency === "string" ? currency : null;
}

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
  const normalizedDisplay = displayCurrency
    ? displayCurrency.toUpperCase()
    : null;
  if (!normalizedDisplay) {
    const dataset =
      (await getReportDataset(userId, "income.monthly", "all")) ?? null;
    const datasetPayload = dataset?.payload;
    let payload: IncomeDatasetPayload | null = isIncomeDatasetPayload(
      datasetPayload,
    )
      ? datasetPayload
      : null;
    if (!payload) {
      const refreshed = await refreshIncomeReportingDataset(userId);
      payload = {
        items: refreshed.items,
        summary: { currency: extractCurrency(refreshed.summary) },
        generatedAt: refreshed.generatedAt.toISOString(),
      };
    }
    const items = payload?.items ?? [];
    const filtered = items.filter((item) => {
      const monthDate = String(item.monthDate ?? "");
      return monthDate >= from && monthDate <= to;
    });
    const actualItems = filtered.filter(
      (item) => item.isForecast !== true && item.isForecast !== "true",
    );
    const buildSeries = (key: string) =>
      actualItems.map((item) => ({
        month: String(item.monthDate),
        value: Number(item[key] ?? 0),
      }));
    const series = {
      gross: buildSeries("gross"),
      bonus: buildSeries("bonus"),
      ltcIncome: buildSeries("ltcIncome"),
      equityIncome: buildSeries("equityIncome"),
      socialInsurance: buildSeries("socialInsurance"),
      housingFund: buildSeries("housingFund"),
      incomeTax: buildSeries("incomeTax"),
      netIncome: buildSeries("netIncome"),
    };
    const totals = actualItems.reduce(
      (acc, item) => {
        acc.totalGross += Number(item.gross ?? 0);
        acc.totalBonus += Number(item.bonus ?? 0);
        acc.totalLtc += Number(item.ltcIncome ?? 0);
        acc.totalEquity += Number(item.equityIncome ?? 0);
        acc.totalSocialInsurance += Number(item.socialInsurance ?? 0);
        acc.totalHousingFund += Number(item.housingFund ?? 0);
        acc.totalSpecialDeductions += Number(item.specialDeductions ?? 0);
        acc.totalTax += Number(item.incomeTax ?? 0);
        acc.totalNet += Number(item.netIncome ?? 0);
        return acc;
      },
      {
        totalGross: 0,
        totalBonus: 0,
        totalLtc: 0,
        totalEquity: 0,
        totalSocialInsurance: 0,
        totalHousingFund: 0,
        totalSpecialDeductions: 0,
        totalTax: 0,
        totalNet: 0,
      },
    );
    const totalIncome =
      totals.totalGross + totals.totalBonus + totals.totalLtc + totals.totalEquity;
    const latestActual = actualItems[actualItems.length - 1] ?? null;
    const summary: IncomeRecordsSummary = {
      months: actualItems.length,
      currency:
        (latestActual?.currency as string | undefined) ??
        (payload?.summary?.currency as string | undefined) ??
        "CNY",
      totalGross: totals.totalGross,
      totalBonus: totals.totalBonus,
      totalLtc: totals.totalLtc,
      totalEquity: totals.totalEquity,
      totalSocialInsurance: totals.totalSocialInsurance,
      totalHousingFund: totals.totalHousingFund,
      totalSpecialDeductions: totals.totalSpecialDeductions,
      totalTax: totals.totalTax,
      totalNet: totals.totalNet,
      totalIncome,
      avgTaxRate: totalIncome > 0 ? (totals.totalTax / totalIncome) * 100 : 0,
      latestTaxPaid: Number(latestActual?.incomeTax ?? 0),
      latestTaxCumulative: Number(latestActual?.taxPaidCumulative ?? 0),
    };
    return NextResponse.json({ series, summary });
  }
  await ensureIncomeRecordsForUser(userId);
  const timeline = await buildIncomeTimeline(
    userId,
    from,
    to,
    normalizedDisplay,
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
