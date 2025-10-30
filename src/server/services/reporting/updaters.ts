import type { Prisma } from "@prisma/client";
import prisma from "@/server/db";
import {
  computeAccountsSummary,
  type AccountsSummaryResult,
} from "@/server/services/accounts-ledger/accounts";
import { upsertReportDataset } from "@/server/services/reporting/dataset";

type DecimalLike = Prisma.Decimal | number | null | undefined;

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
};

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
  await upsertReportDataset({
    userId,
    scope: "dashboard.overview",
    payload: {
      generatedAt: toIsoDate(generatedAt),
      totals: summary.totals,
      displayCurrency: summary.displayCurrency,
      accountCount: summary.items.length,
      allocations: [] as unknown[],
      timeseries: [] as unknown[],
    },
    occurredAt: occurredAt ?? generatedAt,
  });
  return { summary, generatedAt, payload };
}

type IncomeRecordRow = Prisma.IncomeRecordGetPayload<{
  select: {
    monthDate: true;
    currency: true;
    gross: true;
    bonus: true;
    ltcIncome: true;
    equityIncome: true;
    socialInsurance: true;
    housingFund: true;
    specialDeductions: true;
    otherDeductions: true;
    incomeTax: true;
    netIncome: true;
    taxableCurrent: true;
    taxPaidCumulative: true;
    taxableCumulative: true;
    taxCumulative: true;
    isForecast: true;
    socialInsuranceBase: true;
    housingFundBase: true;
    manualIncomeTax: true;
    manualNet: true;
  };
}>;

type IncomeDatasetItem = {
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
  const records = await prisma.incomeRecord.findMany({
    where: { userId },
    orderBy: { monthDate: "asc" },
    select: {
      monthDate: true,
      currency: true,
      gross: true,
      bonus: true,
      ltcIncome: true,
      equityIncome: true,
      socialInsurance: true,
      housingFund: true,
      specialDeductions: true,
      otherDeductions: true,
      incomeTax: true,
      netIncome: true,
      taxableCurrent: true,
      taxPaidCumulative: true,
      taxableCumulative: true,
      taxCumulative: true,
      isForecast: true,
      socialInsuranceBase: true,
      housingFundBase: true,
      manualIncomeTax: true,
      manualNet: true,
    },
  });
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
