"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  BarChart3Icon,
  CalendarIcon,
  DollarSignIcon,
  LineChartIcon,
  PieChartIcon,
  TrendingUpIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchIncomeOverview,
  fetchIncomeTimeseries,
} from "@/lib/api/income-management";
import { formatMoney } from "@/lib/domain/money";
import {
  selectOverviewState,
  selectTimeseriesState,
  useIncomeStore,
} from "@/lib/state/income";
import { useUserPrefsStore } from "@/lib/state/user-prefs";

export default function IncomeOverviewModule() {
  const { displayCurrency } = useUserPrefsStore();
  const currency = displayCurrency || "CNY";

  const {
    stats: overviewStats,
    loading: overviewLoading,
    error: overviewError,
  } = useIncomeStore(selectOverviewState);

  const {
    data: timeseriesData,
    loading: timeseriesLoading,
    error: timeseriesError,
  } = useIncomeStore(selectTimeseriesState);

  const {
    setOverviewStats,
    setOverviewLoading,
    setOverviewError,
    setTimeseriesData,
    setTimeseriesLoading,
    setTimeseriesError,
    recalcToken,
  } = useIncomeStore();

  // 默认查询当年至今的数据
  const currentYear = new Date().getFullYear();
  const [dateRange, setDateRange] = useState({
    startDate: `${currentYear}-01-01`,
    endDate: new Date().toISOString().substring(0, 10),
  });

  // 加载概况数据
  const loadOverviewData = async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    setTimeseriesLoading(true);
    setTimeseriesError(null);

    try {
      const [overviewResult, timeseriesResult] = await Promise.all([
        fetchIncomeOverview(dateRange.startDate, dateRange.endDate),
        fetchIncomeTimeseries(dateRange.startDate, dateRange.endDate),
      ]);

      setOverviewStats(overviewResult);
      setTimeseriesData(timeseriesResult.series);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "加载失败";
      setOverviewError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setOverviewLoading(false);
      setTimeseriesLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    loadOverviewData();
  }, [dateRange, recalcToken]);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">收入概况</h2>
          <p className="text-sm text-gray-600 mt-1">
            查看指定时间范围内的收入统计和趋势
          </p>
        </div>
      </div>

      {/* 时间范围选择 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            统计时间范围
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="overviewStartDate">开始日期</Label>
              <Input
                id="overviewStartDate"
                onChange={(e) =>
                  setDateRange((prev) => ({
                    ...prev,
                    startDate: e.target.value,
                  }))
                }
                type="date"
                value={dateRange.startDate}
              />
            </div>
            <div>
              <Label htmlFor="overviewEndDate">结束日期</Label>
              <Input
                id="overviewEndDate"
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, endDate: e.target.value }))
                }
                type="date"
                value={dateRange.endDate}
              />
            </div>
            <div className="flex items-end">
              <div className="flex gap-2">
                <button
                  className="px-3 py-2 text-sm border rounded hover:bg-gray-50"
                  onClick={() =>
                    setDateRange({
                      startDate: `${currentYear}-01-01`,
                      endDate: new Date().toISOString().substring(0, 10),
                    })
                  }
                >
                  今年至今
                </button>
                <button
                  className="px-3 py-2 text-sm border rounded hover:bg-gray-50"
                  onClick={() =>
                    setDateRange({
                      startDate: `${currentYear - 1}-01-01`,
                      endDate: `${currentYear - 1}-12-31`,
                    })
                  }
                >
                  去年全年
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 年度概况卡片 */}
      {overviewLoading ? (
        <div className="text-center py-8 text-gray-500">
          正在加载概况数据...
        </div>
      ) : overviewError ? (
        <div className="text-center py-8 text-red-500">{overviewError}</div>
      ) : overviewStats && overviewStats.monthsCount > 0 ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSignIcon className="w-5 h-5" />
                收入概况 ({overviewStats.period})
              </CardTitle>
              <CardDescription>
                基于 {overviewStats.monthsCount} 个月数据的统计分析
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {formatMoney(overviewStats.totalGrossIncome, currency)}
                  </div>
                  <div className="text-sm text-gray-600 mb-1">税前收入</div>
                  {overviewStats.yearOverYearGrowth !== 0 && (
                    <div
                      className={`flex items-center justify-center gap-1 text-xs ${
                        overviewStats.yearOverYearGrowth > 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {overviewStats.yearOverYearGrowth > 0 ? (
                        <ArrowUpIcon className="w-3 h-3" />
                      ) : (
                        <ArrowDownIcon className="w-3 h-3" />
                      )}
                      {Math.abs(overviewStats.yearOverYearGrowth * 100).toFixed(
                        1,
                      )}
                      %
                    </div>
                  )}
                </div>

                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-600 mb-2">
                    {formatMoney(overviewStats.totalSocialInsurance, currency)}
                  </div>
                  <div className="text-sm text-gray-600 mb-1">社保</div>
                  <div className="text-xs text-gray-500">
                    占比{" "}
                    {overviewStats.totalGrossIncome > 0
                      ? (
                          (overviewStats.totalSocialInsurance /
                            overviewStats.totalGrossIncome) *
                          100
                        ).toFixed(1)
                      : 0}
                    %
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600 mb-2">
                    {formatMoney(overviewStats.totalHousingFund, currency)}
                  </div>
                  <div className="text-sm text-gray-600 mb-1">公积金</div>
                  <div className="text-xs text-gray-500">
                    占比{" "}
                    {overviewStats.totalGrossIncome > 0
                      ? (
                          (overviewStats.totalHousingFund /
                            overviewStats.totalGrossIncome) *
                          100
                        ).toFixed(1)
                      : 0}
                    %
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {formatMoney(overviewStats.totalNetIncome, currency)}
                  </div>
                  <div className="text-sm text-gray-600 mb-1">税后收入</div>
                  {overviewStats.yearOverYearGrowth !== 0 && (
                    <div
                      className={`flex items-center justify-center gap-1 text-xs ${
                        overviewStats.yearOverYearGrowth > 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {overviewStats.yearOverYearGrowth > 0 ? (
                        <ArrowUpIcon className="w-3 h-3" />
                      ) : (
                        <ArrowDownIcon className="w-3 h-3" />
                      )}
                      {Math.abs(overviewStats.yearOverYearGrowth * 100).toFixed(
                        1,
                      )}
                      %
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-6 border-t">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                  <div>
                    <div className="text-2xl font-bold text-red-600">
                      {formatMoney(overviewStats.totalTax, currency)}
                    </div>
                    <div className="text-sm text-gray-600">个税总额</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-600">
                      {(overviewStats.averageTaxRate * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-600">平均税率</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {formatMoney(overviewStats.monthlyAverage, currency)}
                    </div>
                    <div className="text-sm text-gray-600">月均税后收入</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 月度趋势图 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUpIcon className="w-5 h-5" />
                月度趋势
              </CardTitle>
              <CardDescription>收入趋势变化图表</CardDescription>
            </CardHeader>
            <CardContent>
              {timeseriesLoading ? (
                <div className="text-center py-8 text-gray-500">
                  正在加载趋势数据...
                </div>
              ) : timeseriesError ? (
                <div className="text-center py-8 text-red-500">
                  {timeseriesError}
                </div>
              ) : timeseriesData ? (
                <div className="space-y-4">
                  {/* 简化的趋势展示 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                        <TrendingUpIcon className="w-4 h-4 text-blue-600" />
                        税前收入趋势
                      </h4>
                      <div className="h-32 bg-gray-50 rounded-lg flex items-center justify-center">
                        <div className="text-gray-500 text-sm text-center">
                          <BarChart3Icon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                          图表组件开发中...
                          <br />
                          数据点数: {timeseriesData.gross?.length || 0}
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                        <ArrowUpIcon className="w-4 h-4 text-green-600" />
                        税后收入趋势
                      </h4>
                      <div className="h-32 bg-gray-50 rounded-lg flex items-center justify-center">
                        <div className="text-gray-500 text-sm text-center">
                          <LineChartIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                          图表组件开发中...
                          <br />
                          数据点数: {timeseriesData.netIncome?.length || 0}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 数据概览 */}
                  <div className="pt-4 border-t">
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <PieChartIcon className="w-4 h-4 text-gray-600" />
                      数据概览
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <DollarSignIcon className="w-4 h-4 text-blue-500" />
                        <div>
                          <div className="text-gray-600">工资数据点</div>
                          <div className="font-medium">
                            {timeseriesData.gross?.length || 0} 个月
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUpIcon className="w-4 h-4 text-orange-500" />
                        <div>
                          <div className="text-gray-600">奖金数据点</div>
                          <div className="font-medium">
                            {timeseriesData.bonus?.length || 0} 个月
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-purple-500" />
                        <div>
                          <div className="text-gray-600">长期现金数据点</div>
                          <div className="font-medium">
                            {timeseriesData.ltcIncome?.length || 0} 个月
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <ArrowUpIcon className="w-4 h-4 text-green-500" />
                        <div>
                          <div className="text-gray-600">股权收入数据点</div>
                          <div className="font-medium">
                            {timeseriesData.equityIncome?.length || 0} 个月
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  暂无趋势数据
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSignIcon className="w-5 h-5" />
              暂无收入数据
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <div className="text-gray-500 mb-4">
                还没有收入记录数据。请先配置收入信息，然后执行回算生成收入记录。
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <p>1. 在下方"收入信息录入"中添加工资变更、奖金等信息</p>
                <p>2. 在"收入预测与回算"中点击"年度回算"生成历史记录</p>
                <p>3. 刷新页面查看收入概况统计</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
