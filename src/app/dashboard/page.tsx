"use client";

import {
  ArrowRightIcon,
  BanknoteIcon,
  CalculatorIcon,
  DollarSignIcon,
  PiggyBankIcon,
  SettingsIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, useMemo } from "react";
import AllocPie from "@/components/modules/reporting/Charts/AllocPie";
import NetWorthLine from "@/components/modules/reporting/Charts/NetWorthLine";
import TopAccounts from "@/components/modules/reporting/TopAccounts";
import {
  PageContainer,
  PageHeader,
  PageSection,
} from "@/components/modules/layout/PageLayout";
import DepositDialog from "@/components/modules/accounts/DepositDialog";
import TransferDialog from "@/components/modules/accounts/TransferDialog";
import ValuationFormDialog from "@/components/modules/accounts/ValuationFormDialog";
import WithdrawDialog from "@/components/modules/accounts/WithdrawDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  useAccountsSummary,
  useDashboard,
  useIncomeTimeseries,
} from "@/lib/api/reports";
import { formatMoney } from "@/lib/domain/money";
import { cn } from "@/lib/utils";
import { useUserPrefsStore } from "@/lib/state/identity";
import { accentTokens, semanticAccents } from "@/lib/theme/palette";
import type { AccentKey } from "@/lib/theme/palette";

type MetricAccent = Extract<AccentKey, "primary" | "success" | "accent" | "warning" | "info">;

type MetricCardProps = {
  icon: ReactNode;
  title: string;
  value: ReactNode;
  hint?: ReactNode;
  accent: MetricAccent;
  testId: string;
};

function MetricCard({ icon, title, value, hint, accent, testId }: MetricCardProps) {
  const accentToken = accentTokens[accent];
  return (
    <Card
      className="relative overflow-hidden border border-border/60 bg-card shadow-sm"
      data-testid={testId}
    >
      <div
        className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", accentToken.gradient)}
      />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="text-sm font-medium text-muted-foreground">{title}</div>
        <div className={cn("rounded-md p-2", accentToken.surface)}>{icon}</div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className={cn("text-2xl font-semibold md:text-3xl", accentToken.emphasis)}>
          {value}
        </div>
        {hint ? (
          <div className="mt-2 text-xs text-muted-foreground">{hint}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { displayCurrency, asOfDate } = useUserPrefsStore();
  const { data: dashboardData, isLoading: dashboardLoading } = useDashboard(
    asOfDate ?? undefined,
    displayCurrency ?? undefined,
  );
  const { data: accountsSummary } = useAccountsSummary(
    displayCurrency ?? undefined,
  );

  const currentYear = new Date().getFullYear();
  const { data: incomeData, isLoading: incomeLoading } = useIncomeTimeseries(
    undefined,
    `${currentYear}-01-01`,
    `${currentYear}-12-01`,
    displayCurrency ?? undefined,
  );

  const totals = dashboardData?.totals ?? {
    assets: 0,
    liabilities: 0,
    netWorth: 0,
  };
  const dashboardCurrency =
    dashboardData?.displayCurrency ?? displayCurrency ?? "CNY";

  const netWorthSeries = useMemo(() => {
    if (!dashboardData?.netWorthTrend?.length) return [];
    return dashboardData.netWorthTrend
      .map((point) => {
        const netWorth = Number(point.netWorth);
        if (!Number.isFinite(netWorth)) return null;
        return { x: String(point.month), y: netWorth };
      })
      .filter((item): item is { x: string; y: number } => item !== null);
  }, [dashboardData?.netWorthTrend]);

  const allocEntries = useMemo(
    () =>
      Object.entries(
        (accountsSummary?.items ?? []).reduce(
          (acc: Record<string, number>, item) => {
            const key = item.accountType ?? "OTHER";
            const v = Number(item.displayValue ?? item.valuation ?? 0);
            acc[key] = (acc[key] ?? 0) + v;
            return acc;
          },
          {} as Record<string, number>,
        ),
      ).map(([name, value]) => ({ name, value })),
    [accountsSummary?.items],
  );

  const incomeStatistics = useMemo(() => {
    if (!incomeData?.summary || !incomeData.series) return null;
    const summary = incomeData.summary;
    const grossSeries = incomeData.series.gross ?? [];
    const netSeries = incomeData.series.netIncome ?? [];

    const currentMonthGross = grossSeries.length
      ? Number(grossSeries[grossSeries.length - 1]?.value || 0)
      : 0;
    const currentMonthNet = netSeries.length
      ? Number(netSeries[netSeries.length - 1]?.value || 0)
      : 0;
    const avgMonthlyNet = summary.months
      ? summary.totalNet / summary.months
      : 0;

    return {
      totalIncome: summary.totalIncome,
      totalNet: summary.totalNet,
      totalTax: summary.totalTax,
      effectiveTaxRate: summary.avgTaxRate,
      avgMonthlyNet,
      currentMonthGross,
      currentMonthNet,
      totalSocialInsurance: summary.totalSocialInsurance,
      totalHousingFund: summary.totalHousingFund,
      months: summary.months,
      currency: displayCurrency ?? summary.currency ?? "CNY",
    };
  }, [incomeData, displayCurrency]);

  const metrics = [
    {
      key: "net-worth",
      title: "净资产",
      accent: semanticAccents.netWorth as MetricAccent,
      icon: <PiggyBankIcon className="h-4 w-4" />,
      value: dashboardLoading
        ? "..."
        : formatMoney(totals.netWorth, dashboardCurrency),
      hint: dashboardLoading
        ? null
        : `资产 ${formatMoney(totals.assets, dashboardCurrency)} · 负债 ${formatMoney(totals.liabilities, dashboardCurrency)}`,
    },
    {
      key: "annual-income",
      title: "年度总收入",
      accent: semanticAccents.income.total as MetricAccent,
      icon: <DollarSignIcon className="h-4 w-4" />,
      value: incomeLoading
        ? "..."
        : incomeStatistics
          ? formatMoney(incomeStatistics.totalIncome, incomeStatistics.currency)
          : "--",
      hint:
        incomeStatistics && !incomeLoading
          ? `${incomeStatistics.months} 个月累计`
          : null,
    },
    {
      key: "monthly-income",
      title: "本月税前收入",
      accent: semanticAccents.income.total as MetricAccent,
      icon: <BanknoteIcon className="h-4 w-4" />,
      value: incomeLoading
        ? "..."
        : incomeStatistics
          ? formatMoney(
              incomeStatistics.currentMonthGross,
              incomeStatistics.currency,
            )
          : "--",
      hint:
        incomeStatistics && !incomeLoading
          ? `税后 ${formatMoney(
              incomeStatistics.currentMonthNet,
              incomeStatistics.currency,
            )}`
          : null,
    },
    {
      key: "tax-rate",
      title: "有效税率",
      accent: semanticAccents.income.taxRate as MetricAccent,
      icon: <CalculatorIcon className="h-4 w-4" />,
      value: incomeLoading
        ? "..."
        : incomeStatistics
          ? `${incomeStatistics.effectiveTaxRate.toFixed(1)}%`
          : "--",
      hint:
        incomeStatistics && !incomeLoading
          ? `个税 ${formatMoney(
              incomeStatistics.totalTax,
              incomeStatistics.currency,
            )}`
          : null,
    },
  ];

  return (
    <PageContainer
      gap="lg"
      padding="md"
      testId="dashboard-ui-page"
    >
      <PageHeader
        actions={
          <div
            className="flex flex-wrap items-center gap-2"
            data-testid="dashboard-ui-header-actions"
          >
            <Badge
              className="hidden items-center gap-2 sm:inline-flex"
              data-testid="dashboard-ui-currency-badge"
              variant="secondary"
            >
              展示币种: {displayCurrency ?? "自动"}
            </Badge>
            <Badge
              className="hidden items-center gap-2 sm:inline-flex"
              data-testid="dashboard-ui-date-badge"
              variant="outline"
            >
              统计截止: {asOfDate ?? "未设置"}
            </Badge>
            <Button
              asChild
              className="flex items-center gap-2"
              data-testid="dashboard-ui-preferences"
              size="sm"
              variant="outline"
            >
              <Link href="/settings">
                <SettingsIcon className="h-4 w-4" />
                偏好
              </Link>
            </Button>
            <Link
              className="text-xs text-muted-foreground underline sm:hidden"
              data-testid="dashboard-ui-preferences-mobile"
              href="/settings"
            >
              查看偏好
            </Link>
          </div>
        }
        description="统一监控资产、负债、收入与税费，基于当前偏好展示核心指标。"
        overline="Dashboard"
        testId="dashboard-ui-header"
        title="财务总览"
      />

      <PageSection
        bleed
        contentClassName="border-none bg-transparent p-0 shadow-none"
        testId="dashboard-ui-section-metrics"
        title="关键指标"
        description="净资产、收入与税费概览，数据来自实时回算。"
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard
              accent={metric.accent}
              hint={metric.hint}
              icon={metric.icon}
              key={metric.key}
              testId={`dashboard-ui-metric-${metric.key}`}
              title={metric.title}
              value={metric.value}
            />
          ))}
        </div>
      </PageSection>

      {incomeStatistics ? (
        <PageSection
          testId="dashboard-ui-section-income-summary"
          title={`${currentYear} 年度收入概览`}
          description={`基于 ${incomeStatistics.months} 个月数据的年度收入分析，自动同步社保、公积金与个税。`}
        >
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <IncomeSummaryItem
              label="总收入"
              testId="dashboard-ui-income-total"
              tone={semanticAccents.income.total}
              value={formatMoney(
                incomeStatistics.totalIncome,
                incomeStatistics.currency,
              )}
            />
            <IncomeSummaryItem
              label="净收入"
              testId="dashboard-ui-income-net"
              tone={semanticAccents.income.net}
              value={formatMoney(
                incomeStatistics.totalNet,
                incomeStatistics.currency,
              )}
            />
            <IncomeSummaryItem
              label="社保公积金"
              testId="dashboard-ui-income-si"
              tone={semanticAccents.income.deductions}
              value={formatMoney(
                incomeStatistics.totalSocialInsurance +
                  incomeStatistics.totalHousingFund,
                incomeStatistics.currency,
              )}
            />
            <IncomeSummaryItem
              label="月均净收入"
              testId="dashboard-ui-income-avg"
              tone={semanticAccents.income.net}
              value={formatMoney(
                incomeStatistics.avgMonthlyNet,
                incomeStatistics.currency,
              )}
            />
          </div>
          <div className="flex justify-end">
            <Button
              asChild
              className="flex items-center gap-2"
              size="sm"
              variant="outline"
            >
              <Link href="/income">
                查看收入报表
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </PageSection>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <PageSection
          className="h-full"
          contentClassName="min-h-[260px]"
          description="追踪净资产走势，折线图按选择的币种展示。"
          testId="dashboard-ui-chart-networth"
          title="净资产趋势"
        >
          {dashboardLoading ? (
            <div className="flex h-56 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              <div className="size-8 animate-spin rounded-full border-b-2 border-primary" />
              加载中...
            </div>
          ) : (
            <NetWorthLine currency={dashboardCurrency} data={netWorthSeries} />
          )}
        </PageSection>
        <PageSection
          className="h-full"
          contentClassName="min-h-[260px]"
          description="按账户类型划分资产配置，便于识别集中度风险。"
          testId="dashboard-ui-chart-allocation"
          title="资产分配"
        >
          {allocEntries.length > 0 ? (
            <AllocPie currency={dashboardCurrency} data={allocEntries} />
          ) : (
            <div className="flex h-56 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              <PiggyBankIcon className="h-8 w-8 text-muted-foreground/60" />
              暂无资产数据
            </div>
          )}
        </PageSection>
      </div>

      <TopAccounts />

      <PageSection
        testId="dashboard-ui-quick-actions"
        title="快速操作"
        description="常用的存取款、转账与估值维护入口。"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DepositDialog
            trigger={(
              <Button
                className="flex w-full items-center gap-2"
                data-testid="dashboard-ui-action-deposit"
                variant="outline"
              >
                <TrendingUpIcon className="h-4 w-4" />
                记录存入
              </Button>
            )}
          />
          <WithdrawDialog
            trigger={(
              <Button
                className="flex w-full items-center gap-2"
                data-testid="dashboard-ui-action-withdraw"
                variant="outline"
              >
                <TrendingDownIcon className="h-4 w-4" />
                记录取出
              </Button>
            )}
          />
          <TransferDialog
            trigger={(
              <Button
                className="flex w-full items-center gap-2"
                data-testid="dashboard-ui-action-transfer"
                variant="outline"
              >
                <ArrowRightIcon className="h-4 w-4" />
                发起转账
              </Button>
            )}
          />
          <ValuationFormDialog
            trigger={(
              <Button
                className="flex w-full items-center gap-2"
                data-testid="dashboard-ui-action-valuation"
                variant="outline"
              >
                <CalculatorIcon className="h-4 w-4" />
                记录估值
              </Button>
            )}
          />
        </div>
      </PageSection>
    </PageContainer>
  );
}

type IncomeSummaryItemProps = {
  label: string;
  value: string;
  tone: Extract<AccentKey, "primary" | "success" | "warning" | "accent">;
  testId: string;
};

function IncomeSummaryItem({
  label,
  value,
  tone,
  testId,
}: IncomeSummaryItemProps) {
  const toneToken = accentTokens[tone];

  return (
    <div
      className="rounded-lg border border-border/60 bg-card/90 p-4 shadow-sm"
      data-testid={testId}
    >
      <div className={cn("inline-flex items-center rounded-full px-2 py-1 text-xs font-medium", toneToken.surface)}>
        {label}
      </div>
      <div className={cn("mt-3 text-xl font-semibold", toneToken.emphasis)}>
        {value}
      </div>
    </div>
  );
}
