import type { IncomeRecord } from "@/server/db/types";
import db from "@/server/db";
import { incomeRecords } from "@/server/db/schema";
import { asc, eq } from "drizzle-orm";
import {
  computeAccountsSummary,
  type AccountsSummaryResult,
} from "@/server/services/accounts-ledger/accounts";
import { upsertReportDataset } from "@/server/services/reporting/dataset";
import { buildNetWorthTrend } from "@/server/services/reporting/netWorth";

type DecimalLike = string | number | null | undefined;

function toNumber(value: DecimalLike): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toIsoDate(date: Date): string {
  return date.toISOString();
}

type AccountsSummaryRefreshResult = {
  summary: AccountsSummaryResult;
  generatedAt: Date;
  payload: {
    generatedAt: string;
    displayCurrency: string | null;
    totals: AccountsSummaryResult["totals"];
    items: AccountsSummaryResult["items"];
  };
  dashboardPayload: {
    generatedAt: string;
    displayCurrency: string | null;
    totals: AccountsSummaryResult["totals"];
    accountCount: number;
    allocations: Array<{ accountType: string; value: number }>;
    netWorthTrend: Array<{
      month: string;
      netWorth: number;
      assets: number;
      liabilities: number;
    }>;
  };
};

export function buildAllocations(items: AccountsSummaryResult["items"]) {
  const allocations = new Map<string, number>();
  items.forEach((item) => {
    if ((item.status ?? "ACTIVE") === "ARCHIVED") return;
    if (item.accountType === "LOAN") return;
    const value =
      typeof item.displayValue === "number"
        ? item.displayValue
        : Number(item.valuation ?? 0);
    if (!Number.isFinite(value) || value <= 0) return;
    const key = item.accountType ?? "OTHER";
    allocations.set(key, (allocations.get(key) ?? 0) + value);
  });
  return Array.from(allocations.entries()).map(([accountType, value]) => ({
    accountType,
    value,
  }));
}

export async function refreshAccountsSummaryDataset(
  userId: string,
  occurredAt?: Date | null,
): Promise<AccountsSummaryRefreshResult> {
  const summary = await computeAccountsSummary({
    userId,
  });
  const generatedAt = new Date();
  const payload = {
    generatedAt: toIsoDate(generatedAt),
    displayCurrency: summary.displayCurrency,
    totals: summary.totals,
    items: summary.items,
  };
  await upsertReportDataset({
    userId,
    scope: "accounts.summary",
    payload,
    occurredAt: occurredAt ?? generatedAt,
  });
  const netWorthTrend = await buildNetWorthTrend({
    userId,
    displayCurrency: summary.displayCurrency,
    asOf: occurredAt ?? generatedAt,
  });
  const dashboardPayload = {
    generatedAt: toIsoDate(generatedAt),
    totals: summary.totals,
    displayCurrency: summary.displayCurrency,
    accountCount: summary.items.length,
    allocations: buildAllocations(summary.items),
    netWorthTrend,
  };
  await upsertReportDataset({
    userId,
    scope: "dashboard.overview",
    payload: dashboardPayload,
    occurredAt: occurredAt ?? generatedAt,
  });
  return { summary, generatedAt, payload, dashboardPayload };
}

type IncomeRecordRow = Pick<
  IncomeRecord,
  | "monthDate"
  | "currency"
  | "gross"
  | "bonus"
  | "ltcIncome"
  | "equityIncome"
  | "socialInsurance"
  | "housingFund"
  | "specialDeductions"
  | "otherDeductions"
  | "incomeTax"
  | "netIncome"
  | "taxableCurrent"
  | "taxPaidCumulative"
  | "taxableCumulative"
  | "taxCumulative"
  | "isForecast"
  | "socialInsuranceBase"
  | "housingFundBase"
  | "manualIncomeTax"
  | "manualNet"
>;

export type IncomeDatasetItem = {
  monthDate: string;
  currency: string;
  gross: number;
  bonus: number;
  ltcIncome: number;
  equityIncome: number;
  socialInsurance: number;
  housingFund: number;
  specialDeductions: number;
  otherDeductions: number;
  incomeTax: number;
  netIncome: number;
  taxableCurrent: number;
  taxPaidCumulative: number;
  taxableCumulative: number;
  taxCumulative: number;
  socialInsuranceBase: number | null;
  housingFundBase: number | null;
  manualIncomeTax: number | null;
  manualNet: number | null;
  isForecast: boolean;
};

function normalizeIncomeRecord(row: IncomeRecordRow): IncomeDatasetItem {
  return {
    monthDate: row.monthDate.toISOString().slice(0, 10),
    currency: row.currency,
    gross: toNumber(row.gross),
    bonus: toNumber(row.bonus),
    ltcIncome: toNumber(row.ltcIncome),
    equityIncome: toNumber(row.equityIncome),
    socialInsurance: toNumber(row.socialInsurance),
    housingFund: toNumber(row.housingFund),
    specialDeductions: toNumber(row.specialDeductions),
    otherDeductions: toNumber(row.otherDeductions),
    incomeTax: toNumber(row.incomeTax ?? row.manualIncomeTax),
    netIncome: toNumber(row.netIncome ?? row.manualNet),
    taxableCurrent: toNumber(row.taxableCurrent),
    taxPaidCumulative: toNumber(row.taxPaidCumulative),
    taxableCumulative: toNumber(row.taxableCumulative),
    taxCumulative: toNumber(row.taxCumulative),
    socialInsuranceBase: row.socialInsuranceBase
      ? toNumber(row.socialInsuranceBase)
      : null,
    housingFundBase: row.housingFundBase ? toNumber(row.housingFundBase) : null,
    manualIncomeTax: row.manualIncomeTax ? toNumber(row.manualIncomeTax) : null,
    manualNet: row.manualNet ? toNumber(row.manualNet) : null,
    isForecast: Boolean(row.isForecast),
  };
}

export type IncomeReportingRefreshResult = {
  items: IncomeDatasetItem[];
  summary: Record<string, unknown>;
  generatedAt: Date;
};

export async function refreshIncomeReportingDataset(
  userId: string,
  occurredAt?: Date | null,
): Promise<IncomeReportingRefreshResult> {
  const records: IncomeRecordRow[] = await db
    .select({
      monthDate: incomeRecords.monthDate,
      currency: incomeRecords.currency,
      gross: incomeRecords.gross,
      bonus: incomeRecords.bonus,
      ltcIncome: incomeRecords.ltcIncome,
      equityIncome: incomeRecords.equityIncome,
      socialInsurance: incomeRecords.socialInsurance,
      housingFund: incomeRecords.housingFund,
      specialDeductions: incomeRecords.specialDeductions,
      otherDeductions: incomeRecords.otherDeductions,
      incomeTax: incomeRecords.incomeTax,
      netIncome: incomeRecords.netIncome,
      taxableCurrent: incomeRecords.taxableCurrent,
      taxPaidCumulative: incomeRecords.taxPaidCumulative,
      taxableCumulative: incomeRecords.taxableCumulative,
      taxCumulative: incomeRecords.taxCumulative,
      isForecast: incomeRecords.isForecast,
      socialInsuranceBase: incomeRecords.socialInsuranceBase,
      housingFundBase: incomeRecords.housingFundBase,
      manualIncomeTax: incomeRecords.manualIncomeTax,
      manualNet: incomeRecords.manualNet,
    })
    .from(incomeRecords)
    .where(eq(incomeRecords.userId, userId))
    .orderBy(asc(incomeRecords.monthDate));
  const items = records.map((row) => normalizeIncomeRecord(row));
  const actualItems = items.filter((item) => !item.isForecast);
  const totals = actualItems.reduce(
    (acc, item) => {
      acc.totalGross += item.gross;
      acc.totalBonus += item.bonus;
      acc.totalLtc += item.ltcIncome;
      acc.totalEquity += item.equityIncome;
      acc.totalSocialInsurance += item.socialInsurance;
      acc.totalHousingFund += item.housingFund;
      acc.totalSpecialDeductions += item.specialDeductions;
      acc.totalTax += item.incomeTax;
      acc.totalNet += item.netIncome;
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
  const currency =
    actualItems[actualItems.length - 1]?.currency ??
    items[items.length - 1]?.currency ??
    "CNY";
  const summary = {
    months: actualItems.length,
    currency,
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
    latestTaxPaid: latestActual?.incomeTax ?? 0,
    latestTaxCumulative: latestActual?.taxPaidCumulative ?? 0,
  };
  const generatedAt = new Date();
  await upsertReportDataset({
    userId,
    scope: "income.monthly",
    bucket: "all",
    payload: {
      generatedAt: toIsoDate(generatedAt),
      items,
      summary,
    },
    occurredAt: occurredAt ?? generatedAt,
  });
  return { items, summary, generatedAt };
}
