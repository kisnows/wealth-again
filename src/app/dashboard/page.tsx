"use client";

import {
  ArrowRightIcon,
  BanknoteIcon,
  CalculatorIcon,
  CalendarIcon,
  DollarSignIcon,
  PiggyBankIcon,
  SettingsIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import AllocPie from "@/components/modules/Charts/AllocPie";
import NetWorthLine from "@/components/modules/Charts/NetWorthLine";
import TopAccounts from "@/components/modules/TopAccounts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  useAccountsSummary,
  useDashboard,
  useIncomeTimeseries,
} from "@/lib/api/reports";
import { formatMoney } from "@/lib/domain/money";
import { useUserPrefsStore } from "@/lib/state/user-prefs";

export default function DashboardPage() {
  const { displayCurrency, asOfDate } = useUserPrefsStore();
  const { data: dashboardData, isLoading: dashboardLoading } = useDashboard(
    asOfDate ?? undefined,
    displayCurrency ?? undefined,
  );
  const { data: accountsSummary } = useAccountsSummary(
    displayCurrency ?? undefined,
  );

  // 获取当前年度的收入数据
  const currentYear = new Date().getFullYear();
  const { data: incomeData, isLoading: incomeLoading } = useIncomeTimeseries(
    undefined,
    `${currentYear}-01-01`,
    `${currentYear}-12-01`,
  );

  const totals = dashboardData?.totals ?? {
    assets: 0,
    liabilities: 0,
    netWorth: 0,
  };

  // 处理资产配置数据
  const allocEntries = Object.entries(
    (accountsSummary?.items ?? []).reduce(
      (acc: Record<string, number>, it: any) => {
        const key = (it as any).accountType ?? "OTHER";
        const v = Number(
          (it as any).displayValue ?? (it as any).valuation ?? 0,
        );
        acc[key] = (acc[key] ?? 0) + v;
        return acc;
      },
      {} as Record<string, number>,
    ),
  ).map(([name, value]) => ({ name, value }));

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

  return (
    <main className="p-6 space-y-6">
      {/* 页面标题和控制 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">财务总览</h1>
          <p className="text-sm text-gray-600 mt-1">
            资产负债、收入支出的综合仪表盘
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            className="w-32"
            placeholder="币种 (CNY)"
            value={displayCurrency ?? ""}
            onChange={(e) =>
              useUserPrefsStore
                .getState()
                .setDisplayCurrency(e.target.value || null)
            }
          />
          <Input
            className="w-40"
            type="date"
            placeholder="统计日期"
            value={asOfDate ?? ""}
            onChange={(e) =>
              useUserPrefsStore.getState().setAsOfDate(e.target.value || null)
            }
          />
          <Button variant="outline" size="sm">
            <SettingsIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 核心KPI卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 净资产 */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              净资产
            </CardTitle>
            <PiggyBankIcon className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {dashboardLoading
                ? "..."
                : formatMoney(totals.netWorth, displayCurrency ?? "CNY")}
            </div>
            <div className="flex items-center text-xs text-gray-500 mt-1">
              <span>
                资产 {formatMoney(totals.assets, displayCurrency ?? "CNY")}
              </span>
              <span className="mx-1">•</span>
              <span>
                负债 {formatMoney(totals.liabilities, displayCurrency ?? "CNY")}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 年度收入 */}
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              年度总收入
            </CardTitle>
            <DollarSignIcon className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {incomeLoading
                ? "..."
                : incomeStatistics
                  ? formatMoney(
                      incomeStatistics.totalIncome,
                      incomeStatistics.currency,
                    )
                  : "--"}
            </div>
            <div className="flex items-center text-xs text-gray-500 mt-1">
              {incomeStatistics && (
                <>
                  <TrendingUpIcon className="w-3 h-3 mr-1" />
                  <span>{incomeStatistics.months} 个月</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 本月收入 */}
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              本月收入
            </CardTitle>
            <BanknoteIcon className="w-4 h-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {incomeLoading
                ? "..."
                : incomeStatistics
                  ? formatMoney(
                      incomeStatistics.currentMonthGross,
                      incomeStatistics.currency,
                    )
                  : "--"}
            </div>
            <div className="flex items-center text-xs text-gray-500 mt-1">
              {incomeStatistics && (
                <span>
                  税后{" "}
                  {formatMoney(
                    incomeStatistics.currentMonthNet,
                    incomeStatistics.currency,
                  )}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 有效税率 */}
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              有效税率
            </CardTitle>
            <CalculatorIcon className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {incomeLoading
                ? "..."
                : incomeStatistics
                  ? `${incomeStatistics.effectiveTaxRate.toFixed(1)}%`
                  : "--"}
            </div>
            <div className="flex items-center text-xs text-gray-500 mt-1">
              {incomeStatistics && (
                <span>
                  个税{" "}
                  {formatMoney(
                    incomeStatistics.totalTax,
                    incomeStatistics.currency,
                  )}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 年度收入详情 */}
      {incomeStatistics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              {currentYear} 年度收入概览
            </CardTitle>
            <CardDescription>
              基于 {incomeStatistics.months} 个月数据的年度收入分析
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
              <div>
                <div className="text-gray-600">总收入</div>
                <div className="text-lg font-semibold text-blue-600">
                  {formatMoney(
                    incomeStatistics.totalIncome,
                    incomeStatistics.currency,
                  )}
                </div>
              </div>
              <div>
                <div className="text-gray-600">净收入</div>
                <div className="text-lg font-semibold text-green-600">
                  {formatMoney(
                    incomeStatistics.totalNet,
                    incomeStatistics.currency,
                  )}
                </div>
              </div>
              <div>
                <div className="text-gray-600">社保公积金</div>
                <div className="text-lg font-semibold text-orange-600">
                  {formatMoney(
                    incomeStatistics.totalSocialInsurance +
                      incomeStatistics.totalHousingFund,
                    incomeStatistics.currency,
                  )}
                </div>
              </div>
              <div>
                <div className="text-gray-600">月均净收入</div>
                <div className="text-lg font-semibold text-purple-600">
                  {formatMoney(
                    incomeStatistics.avgMonthlyNet,
                    incomeStatistics.currency,
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <Link href="/reports/income">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  查看详细报表
                  <ArrowRightIcon className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">净资产趋势</CardTitle>
            <CardDescription>近期净资产变化曲线</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboardLoading ? (
              <div className="flex items-center justify-center h-48 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mr-3"></div>
                加载中...
              </div>
            ) : (
              <NetWorthLine data={dashboardData?.netWorthTrend ?? []} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">资产分配</CardTitle>
            <CardDescription>按账户类型的资产占比</CardDescription>
          </CardHeader>
          <CardContent>
            {allocEntries.length > 0 ? (
              <AllocPie data={allocEntries} />
            ) : (
              <div className="flex items-center justify-center h-48 text-gray-500">
                <div className="text-center">
                  <PiggyBankIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>暂无资产数据</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 账户TOP列表 */}
      <TopAccounts />

      {/* 快速操作 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">快速操作</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link href="/entries/deposit">
              <Button
                variant="outline"
                className="w-full flex items-center gap-2"
              >
                <TrendingUpIcon className="w-4 h-4" />
                存款
              </Button>
            </Link>
            <Link href="/entries/withdraw">
              <Button
                variant="outline"
                className="w-full flex items-center gap-2"
              >
                <TrendingDownIcon className="w-4 h-4" />
                取款
              </Button>
            </Link>
            <Link href="/entries/transfer">
              <Button
                variant="outline"
                className="w-full flex items-center gap-2"
              >
                <ArrowRightIcon className="w-4 h-4" />
                转账
              </Button>
            </Link>
            <Link href="/income/recalc">
              <Button
                variant="outline"
                className="w-full flex items-center gap-2"
              >
                <CalculatorIcon className="w-4 h-4" />
                收入回算
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
