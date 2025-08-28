"use client";

import {
  AlertCircleIcon,
  CalculatorIcon,
  CalendarIcon,
  TrendingUpIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
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
import { useIncomeRecords } from "@/lib/api/income";
import { formatMoney } from "@/lib/domain/money";

export default function IncomeRecordsPage() {
  const currentYear = new Date().getFullYear();
  const [range, setRange] = useState({
    from: `${currentYear}-01-01`,
    to: `${currentYear}-12-01`,
    userId: "",
  });

  const { data, isLoading, error } = useIncomeRecords(
    range.userId || undefined,
    range.from,
    range.to,
  );
  const items = data?.items ?? [];

  // 计算统计数据
  const statistics = useMemo(() => {
    if (!items.length) return null;

    const totalGross = items.reduce(
      (sum: number, r: any) => sum + Number(r.gross || 0),
      0,
    );
    const totalBonus = items.reduce(
      (sum: number, r: any) => sum + Number(r.bonus || 0),
      0,
    );
    const totalTax = items.reduce(
      (sum: number, r: any) => sum + Number(r.incomeTax || 0),
      0,
    );
    const totalNet = items.reduce(
      (sum: number, r: any) => sum + Number(r.netIncome || 0),
      0,
    );
    const totalSS = items.reduce(
      (sum: number, r: any) => sum + Number(r.socialInsurance || 0),
      0,
    );
    const totalHF = items.reduce(
      (sum: number, r: any) => sum + Number(r.housingFund || 0),
      0,
    );

    const avgTaxRate = totalGross > 0 ? (totalTax / totalGross) * 100 : 0;

    return {
      totalGross,
      totalBonus,
      totalTax,
      totalNet,
      totalSS,
      totalHF,
      avgTaxRate,
      months: items.length,
      currency: items[0]?.currency || "CNY",
    };
  }, [items]);

  return (
    <main className="p-6 space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">收入快照</h1>
          <p className="text-sm text-gray-600 mt-1">
            月度收入明细与税务计算结果
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/income/recalc">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <CalculatorIcon className="w-4 h-4" />
              年度回算
            </Button>
          </Link>
        </div>
      </div>

      {/* 筛选条件 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" />
            筛选条件
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                开始日期
              </label>
              <Input
                type="date"
                value={range.from.slice(0, 10)}
                onChange={(e) => setRange({ ...range, from: e.target.value })}
                className="w-full"
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
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                用户ID（可选）
              </label>
              <Input
                placeholder="输入用户ID"
                value={range.userId}
                onChange={(e) => setRange({ ...range, userId: e.target.value })}
                className="w-full"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => {
                  /* SWR自动刷新 */
                }}
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? "查询中..." : "查询"}
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
                <div className="p-2 bg-blue-50 rounded-lg">
                  <TrendingUpIcon className="w-5 h-5 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">
                    累计税前收入
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatMoney(statistics.totalGross, statistics.currency)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-50 rounded-lg">
                  <TrendingUpIcon className="w-5 h-5 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">
                    累计税后收入
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatMoney(statistics.totalNet, statistics.currency)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-red-50 rounded-lg">
                  <AlertCircleIcon className="w-5 h-5 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">累计个税</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatMoney(statistics.totalTax, statistics.currency)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <CalculatorIcon className="w-5 h-5 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">平均税率</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {statistics.avgTaxRate.toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 数据展示 */}
      <Card>
        <CardHeader>
          <CardTitle>收入明细记录</CardTitle>
          <CardDescription>
            共 {items.length} 条记录
            {statistics && `（${statistics.months} 个月）`}
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
              加载中...
            </div>
          ) : items.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              <AlertCircleIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">暂无数据</p>
              <p className="text-sm">请调整筛选条件或创建收入记录</p>
            </div>
          ) : (
            <Tabs defaultValue="detailed" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="detailed">详细视图</TabsTrigger>
                <TabsTrigger value="summary">汇总视图</TabsTrigger>
              </TabsList>

              <TabsContent value="detailed" className="mt-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-24">月份</TableHead>
                        <TableHead className="text-right">税前工资</TableHead>
                        <TableHead className="text-right">奖金</TableHead>
                        <TableHead className="text-right">长期现金</TableHead>
                        <TableHead className="text-right">股权激励</TableHead>
                        <TableHead className="text-right">社保个人</TableHead>
                        <TableHead className="text-right">公积金个人</TableHead>
                        <TableHead className="text-right">当月个税</TableHead>
                        <TableHead className="text-right">税后净收</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((r: any, index: number) => {
                        const monthStr = String(r.monthDate).slice(0, 7);
                        const _totalIncome =
                          Number(r.gross || 0) +
                          Number(r.bonus || 0) +
                          Number(r.ltcIncome || 0) +
                          Number(r.equityIncome || 0);

                        return (
                          <TableRow
                            key={r.id}
                            className={index % 2 === 0 ? "bg-gray-50/50" : ""}
                          >
                            <TableCell className="font-medium">
                              {monthStr}
                              {Number(r.bonus || 0) > 0 && (
                                <Badge
                                  variant="secondary"
                                  className="ml-2 text-xs"
                                >
                                  奖金
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatMoney(
                                Number(r.gross || 0),
                                r.currency || "CNY",
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {Number(r.bonus || 0) > 0 ? (
                                <span className="text-green-600">
                                  {formatMoney(
                                    Number(r.bonus || 0),
                                    r.currency || "CNY",
                                  )}
                                </span>
                              ) : (
                                <span className="text-gray-400">--</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {Number(r.ltcIncome || 0) > 0 ? (
                                <span className="text-blue-600">
                                  {formatMoney(
                                    Number(r.ltcIncome || 0),
                                    r.currency || "CNY",
                                  )}
                                </span>
                              ) : (
                                <span className="text-gray-400">--</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {Number(r.equityIncome || 0) > 0 ? (
                                <span className="text-purple-600">
                                  {formatMoney(
                                    Number(r.equityIncome || 0),
                                    r.currency || "CNY",
                                  )}
                                </span>
                              ) : (
                                <span className="text-gray-400">--</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-orange-600">
                              {formatMoney(
                                Number(r.socialInsurance || 0),
                                r.currency || "CNY",
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-orange-600">
                              {formatMoney(
                                Number(r.housingFund || 0),
                                r.currency || "CNY",
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-red-600">
                              {formatMoney(
                                Number(r.incomeTax || 0),
                                r.currency || "CNY",
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold">
                              {formatMoney(
                                Number(r.netIncome || 0),
                                r.currency || "CNY",
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="summary" className="mt-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>月份</TableHead>
                        <TableHead className="text-right">当期应税</TableHead>
                        <TableHead className="text-right">累计应税</TableHead>
                        <TableHead className="text-right">累计应纳税</TableHead>
                        <TableHead className="text-right">累计已缴</TableHead>
                        <TableHead className="text-right">税率档位</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((r: any, index: number) => {
                        const monthStr = String(r.monthDate).slice(0, 7);
                        const cumTaxable = Number(r.taxableCumulative || 0);
                        const taxRate =
                          cumTaxable > 0 && Number(r.taxCumulative || 0) > 0
                            ? (
                                (Number(r.taxCumulative || 0) / cumTaxable) *
                                100
                              ).toFixed(1)
                            : "0.0";

                        return (
                          <TableRow
                            key={r.id}
                            className={index % 2 === 0 ? "bg-gray-50/50" : ""}
                          >
                            <TableCell className="font-medium">
                              {monthStr}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatMoney(
                                Number(r.taxableIncome || 0),
                                r.currency || "CNY",
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatMoney(
                                Number(r.taxableCumulative || 0),
                                r.currency || "CNY",
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatMoney(
                                Number(r.taxCumulative || 0),
                                r.currency || "CNY",
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatMoney(
                                Number(r.taxPaid || 0),
                                r.currency || "CNY",
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline">{taxRate}%</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
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
