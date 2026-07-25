/* eslint-disable */
// 此文件由 scripts/generate-openapi-types.mjs 自动生成，请勿手动修改。

export type AccountsSummary = {
  displayCurrency: string | null;
  items: Array<AccountSummaryItem>;
  totals: {
    archived: number;
    assets: number;
    liabilities: number;
    netWorth: number;
  };
};

export type AccountSummaryItem = {
  accountType: string;
  currency: string;
  displayPrincipal?: number | null;
  displayProfit?: number | null;
  displayValue?: number | null;
  id: string;
  name: string;
  principal: number;
  profit?: number | null;
  roi?: number | null;
  valuation: number;
  valuationCurrency?: string | null;
};

export type AdminUserItem = {
  createdAt: string;
  currentCity?: CitySummary;
  currentCityId: string;
  displayCurrency?: string | null;
  email: string;
  id: string;
  isActive: boolean;
  name?: string | null;
  updatedAt: string;
};

export type CityChange = {
  createdAt: string;
  effectiveMonth: string;
  fromCity?: CitySummary;
  id: string;
  reason?: string | null;
  toCity: CitySummary;
  toCityId: string;
};

export type CitySummary = {
  country: string;
  id: string;
  name: string;
} | null;

export type DashboardResponse = {
  accountCount?: number | null;
  allocations: Array<{
    accountType: string;
    value: number;
  }>;
  displayCurrency: string | null;
  generatedAt?: string | null;
  netWorthTrend: Array<{
    month: string;
    netWorth: number;
    assets?: number;
    liabilities?: number;
  }>;
  totals: {
    archived: number;
    assets: number;
    liabilities: number;
    netWorth: number;
  };
};

export type FxLatestRate = {
  effectiveFrom: string | null;
  effectiveTo: string | null;
  quote: string;
  rate: number | null;
};

export type FxRate = {
  base: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  id: string;
  quote: string;
  rate: number;
};

export type IncomeRecord = {
  bonus: number;
  currency: string;
  equityIncome: number;
  gross: number;
  housingFund: number;
  id: string;
  incomeTax: number;
  ltcIncome: number;
  monthDate: string;
  netIncome: number;
  socialInsurance: number;
  taxPaidCumulative: number;
  userId: string;
};

export type IncomeSummary = {
  avgTaxRate: number;
  currency: string;
  latestTaxCumulative: number;
  latestTaxPaid: number;
  months: number;
  totalBonus: number;
  totalEquity: number;
  totalGross: number;
  totalHousingFund: number;
  totalIncome: number;
  totalLtc: number;
  totalNet: number;
  totalSocialInsurance: number;
  totalSpecialDeductions: number;
  totalTax: number;
};

export type ReportDatasetItem = {
  bucket: string;
  id: string;
  occurredAt?: string | null;
  payload: {
    [key: string]: unknown;
  } | null;
  scope: string;
  updatedAt: string;
};

export type UserProfile = {
  currentCityId: string | null;
  displayCurrency: string | null;
  email: string;
  id: string;
  name?: string | null;
};

export type ValuationSnapshot = {
  accountId: string;
  asOf: string;
  currency: string;
  fxSnapshotId?: string | null;
  id: string;
  totalValue: number;
};

export type WithdrawRequest = {
  accountId: string;
  amount: number;
  currency: string;
  note?: string;
  occurredAt: string;
};

export interface OpenAPISchemas {
  AccountsSummary: AccountsSummary;
  AccountSummaryItem: AccountSummaryItem;
  AdminUserItem: AdminUserItem;
  CityChange: CityChange;
  CitySummary: CitySummary;
  DashboardResponse: DashboardResponse;
  FxLatestRate: FxLatestRate;
  FxRate: FxRate;
  IncomeRecord: IncomeRecord;
  IncomeSummary: IncomeSummary;
  ReportDatasetItem: ReportDatasetItem;
  UserProfile: UserProfile;
  ValuationSnapshot: ValuationSnapshot;
  WithdrawRequest: WithdrawRequest;
}

// 生成时间戳：2025-10-31T08:13:34.032Z
