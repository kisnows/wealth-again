"use client";

import {
  AlertCircleIcon,
  BanknoteIcon,
  BarChart3Icon,
  CalendarIcon,
  DollarSignIcon,
  PieChartIcon,
  TrendingUpIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import IncomeStackedBar from "@/components/modules/Charts/IncomeStackedBar";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIncomeTimeseries } from "@/lib/api/reports";
import { formatMoney } from "@/lib/domain/money";

export default function ReportsIncomePage() {
  const currentYear = new Date().getFullYear();
  const [range, setRange] = useState({
    from: `${currentYear}-01-01`,
    to: `${currentYear}-12-01`,
  });

  const { data, isLoading, error } = useIncomeTimeseries(
    undefined, // 不再需要userId参数，API会自动使用当前用户
    range.from,
    range.to,
  );

  // 数据处理和统计
  const processedData = useMemo(() => {
    if (!data?.series) return { items: [], statistics: null };

    const items = (data.series.gross ?? []).map((g: any, i: number) => ({
    month: g.month,
    gross: Number(g.value || 0),
      bonus: Number(data.series.bonus?.[i]?.value || 0),
      ltcIncome: Number(data.series.ltcIncome?.[i]?.value || 0),
      equityIncome: Number(data.series.equityIncome?.[i]?.value || 0),
      socialInsurance: Number(data.series.socialInsurance?.[i]?.value || 0),
      housingFund: Number(data.series.housingFund?.[i]?.value || 0),
      incomeTax: Number(data.series.incomeTax?.[i]?.value || 0),
      netIncome: Number(data.series.netIncome?.[i]?.value || 0),
    }));

    // 计算统计数据
    if (items.length === 0) return { items, statistics: null };

    const totals = items.reduce(
      (acc: {
        gross: number;
        bonus: number;
        ltcIncome: number;
        equityIncome: number;
        socialInsurance: number;
        housingFund: number;
        incomeTax: number;
        netIncome: number;
      }, item: {
        month: string;
        gross: number;
        bonus: number;
        ltcIncome: number;
        equityIncome: number;
        socialInsurance: number;
        housingFund: number;
        incomeTax: number;
        netIncome: number;
      }) => {
        acc.gross += item.gross;
        acc.bonus += item.bonus;
        acc.ltcIncome += item.ltcIncome;
        acc.equityIncome += item.equityIncome;
        acc.socialInsurance += item.socialInsurance;
        acc.housingFund += item.housingFund;
        acc.incomeTax += item.incomeTax;
        acc.netIncome += item.netIncome;
        return acc;
      },
      {
        gross: 0,
        bonus: 0,
        ltcIncome: 0,
        equityIncome: 0,
        socialInsurance: 0,
        housingFund: 0,
        incomeTax: 0,
        netIncome: 0,
      },
    );

    const totalIncome =
      totals.gross + totals.bonus + totals.ltcIncome + totals.equityIncome;
    const totalDeductions =
      totals.socialInsurance + totals.housingFund + totals.incomeTax;
    const effectiveTaxRate =
      totalIncome > 0 ? (totals.incomeTax / totalIncome) * 100 : 0;
    const avgMonthlyNet =
      items.length > 0 ? totals.netIncome / items.length : 0;

    return {
      items,
      statistics: {
        totalIncome,
        totalDeductions,
        totalNet: totals.netIncome,
        effectiveTaxRate,
        avgMonthlyNet,
        months: items.length,
        breakdown: totals,
        currency: "CNY",
      },
    };
  }, [data]);

  const { items, statistics } = processedData;

  return (
    <main className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">收入时序报表</h1>
          <p className="text-sm text-gray-600 mt-1">
            月度收入、税务和净收入的趋势分析
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-2">
          <BarChart3Icon className="w-4 h-4" />
          时序分析
        </Badge>
      </div>

      {/* 筛选条件 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" />
            时间范围
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                开始日期
              </label>
              <Input
                type="date"
                value={range.from.slice(0, 10)}
                onChange={(e) => setRange({ ...range, from: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                结束日期
              </label>
              <Input
                type="date"
                value={range.to.slice(0, 10)}
                onChange={(e) => setRange({ ...range, to: e.target.value })}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => {
                  /* SWR 自动根据 key 变化刷新 */
                }}
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? "分析中..." : "分析"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 统计概览 */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-50 rounded-lg">
                  <DollarSignIcon className="w-5 h-5 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">总收入</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatMoney(statistics.totalIncome, statistics.currency)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {statistics.months} 个月
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <BanknoteIcon className="w-5 h-5 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">净收入</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatMoney(statistics.totalNet, statistics.currency)}
                  </p>
                  <p className="text-xs text-gray-500">
                    月均{" "}
                    {formatMoney(statistics.avgMonthlyNet, statistics.currency)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-red-50 rounded-lg">
                  <TrendingUpIcon className="w-5 h-5 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">有效税率</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {statistics.effectiveTaxRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-500">
                    个税{" "}
                    {formatMoney(
                      statistics.breakdown.incomeTax,
                      statistics.currency,
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-orange-50 rounded-lg">
                  <PieChartIcon className="w-5 h-5 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">总扣缴</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatMoney(
                      statistics.totalDeductions,
                      statistics.currency,
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    社保公积金{" "}
                    {formatMoney(
                      statistics.breakdown.socialInsurance +
                        statistics.breakdown.housingFund,
                      statistics.currency,
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 图表和数据展示 */}
      <Card>
        <CardHeader>
          <CardTitle>收入趋势分析</CardTitle>
          <CardDescription>
            {items.length > 0
              ? `显示 ${items.length} 个月的收入、税务和净收入趋势`
              : "选择时间范围以查看趋势"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex items-center justify-center p-8 text-red-600">
              <AlertCircleIcon className="w-5 h-5 mr-2" />
              加载数据失败，请重试
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center p-8 text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mr-3"></div>
              分析中...
            </div>
          ) : items.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              <BarChart3Icon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">暂无数据</p>
              <p className="text-sm">请调整时间范围或创建收入记录</p>
            </div>
          ) : (
            <Tabs defaultValue="chart" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="chart">图表视图</TabsTrigger>
                <TabsTrigger value="table">表格视图</TabsTrigger>
              </TabsList>

              <TabsContent value="chart" className="mt-4">
                <div className="space-y-4">
                  <IncomeStackedBar items={items} />

                  {/* 图例 */}
                  <div className="flex flex-wrap gap-4 justify-center text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-400 rounded"></div>
                      <span>基础工资</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-400 rounded"></div>
                      <span>奖金</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-yellow-400 rounded"></div>
                      <span>长期现金</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-pink-400 rounded"></div>
                      <span>股权激励</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-purple-400 rounded"></div>
                      <span>社保</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-pink-400 rounded"></div>
                      <span>公积金</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-gray-400 rounded"></div>
                      <span>个税</span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="table" className="mt-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>月份</TableHead>
                        <TableHead className="text-right">基础工资</TableHead>
                        <TableHead className="text-right">奖金</TableHead>
                        <TableHead className="text-right">长期现金</TableHead>
                        <TableHead className="text-right">股权激励</TableHead>
                        <TableHead className="text-right">社保</TableHead>
                        <TableHead className="text-right">公积金</TableHead>
                        <TableHead className="text-right">个税</TableHead>
                        <TableHead className="text-right">净收入</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item: {
                        month: string;
                        gross: number;
                        bonus: number;
                        ltcIncome: number;
                        equityIncome: number;
                        socialInsurance: number;
                        housingFund: number;
                        incomeTax: number;
                        netIncome: number;
                      }, index: number) => (
                        <TableRow
                          key={index}
                          className={index % 2 === 0 ? "bg-gray-50/50" : ""}
                        >
                          <TableCell className="font-medium">
                            {item.month}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatMoney(item.gross, "CNY")}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {item.bonus > 0 ? (
                              <span className="text-green-600">
                                {formatMoney(item.bonus, "CNY")}
                              </span>
                            ) : (
                              <span className="text-gray-400">--</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {item.ltcIncome > 0 ? (
                              <span className="text-blue-600">
                                {formatMoney(item.ltcIncome, "CNY")}
                              </span>
                            ) : (
                              <span className="text-gray-400">--</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {item.equityIncome > 0 ? (
                              <span className="text-purple-600">
                                {formatMoney(item.equityIncome, "CNY")}
                              </span>
                            ) : (
                              <span className="text-gray-400">--</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-orange-600">
                            {formatMoney(item.socialInsurance, "CNY")}
                          </TableCell>
                          <TableCell className="text-right font-mono text-orange-600">
                            {formatMoney(item.housingFund, "CNY")}
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-600">
                            {formatMoney(item.incomeTax, "CNY")}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {formatMoney(item.netIncome, "CNY")}
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* 汇总行 */}
                      {statistics && (
                        <TableRow className="bg-gray-100 font-semibold">
                          <TableCell>总计</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatMoney(statistics.breakdown.gross, "CNY")}
                          </TableCell>
                          <TableCell className="text-right font-mono text-green-600">
                            {formatMoney(statistics.breakdown.bonus, "CNY")}
                          </TableCell>
                          <TableCell className="text-right font-mono text-blue-600">
                            {formatMoney(statistics.breakdown.ltcIncome, "CNY")}
                          </TableCell>
                          <TableCell className="text-right font-mono text-purple-600">
                            {formatMoney(
                              statistics.breakdown.equityIncome,
                              "CNY",
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-orange-600">
                            {formatMoney(
                              statistics.breakdown.socialInsurance,
                              "CNY",
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-orange-600">
                            {formatMoney(
                              statistics.breakdown.housingFund,
                              "CNY",
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-600">
                            {formatMoney(statistics.breakdown.incomeTax, "CNY")}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold">
                            {formatMoney(statistics.breakdown.netIncome, "CNY")}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
