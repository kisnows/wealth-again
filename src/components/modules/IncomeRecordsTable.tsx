"use client";

import {
  AlertCircleIcon,
  CalendarIcon,
  RefreshCwIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIncomeRecords } from "@/lib/api/income";
import { formatMoney } from "@/lib/domain/money";

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function IncomeRecordsTable() {
  const now = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(() => new Date(now.getFullYear(), 0, 1), [now]);
  const [range, setRange] = useState({
    from: formatDateInput(defaultFrom),
    to: formatDateInput(now),
  });
  const { data, error, isLoading, mutate } = useIncomeRecords(
    undefined,
    range.from,
    range.to,
  );
  const items = data?.items ?? [];
  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" />
            查询区间
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                开始日期
              </label>
              <Input
                onChange={(e) =>
                  setRange((prev) => ({ ...prev, from: e.target.value }))
                }
                type="date"
                value={range.from}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                结束日期
              </label>
              <Input
                max={formatDateInput(now)}
                onChange={(e) =>
                  setRange((prev) => ({ ...prev, to: e.target.value }))
                }
                type="date"
                value={range.to}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                className="flex-1"
                disabled={isLoading}
                onClick={() => mutate()}
              >
                <RefreshCwIcon className="w-4 h-4 mr-2" /> 刷新
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-50 p-2">
                  <TrendingUpIcon className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">累计税前收入</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {formatMoney(summary.totalGross, summary.currency || "CNY")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-50 p-2">
                  <TrendingUpIcon className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">累计税后收入</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {formatMoney(summary.totalNet, summary.currency || "CNY")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-red-50 p-2">
                  <TrendingDownIcon className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">累计个税</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {formatMoney(summary.totalTax, summary.currency || "CNY")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-purple-50 p-2">
                  <TrendingUpIcon className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">平均税率</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {summary.avgTaxRate.toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">收入明细</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex items-center justify-center p-6 text-red-600">
              <AlertCircleIcon className="w-5 h-5 mr-2" />
              加载失败，请重试
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center p-6 text-gray-500">
              加载中...
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 text-gray-500">
              <AlertCircleIcon className="w-10 h-10 mb-2 text-gray-300" />
              暂无记录
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>月份</TableHead>
                    <TableHead className="text-right">税前收入</TableHead>
                    <TableHead className="text-right">奖金</TableHead>
                    <TableHead className="text-right">长期现金</TableHead>
                    <TableHead className="text-right">股权激励</TableHead>
                    <TableHead className="text-right">社保</TableHead>
                    <TableHead className="text-right">公积金</TableHead>
                    <TableHead className="text-right">个税</TableHead>
                    <TableHead className="text-right">当期应税</TableHead>
                    <TableHead className="text-right">累计应税</TableHead>
                    <TableHead className="text-right">累计应纳税额</TableHead>
                    <TableHead className="text-right">累计已预扣</TableHead>
                    <TableHead className="text-right">税后净收</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const currency =
                      item.currency || summary?.currency || "CNY";
                    const monthLabel = String(item.monthDate).slice(0, 7);

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {monthLabel}
                          {item.manualNetIncome ? (
                            <Badge className="ml-2" variant="secondary">
                              人工调整
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatMoney(Number(item.gross || 0), currency)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatMoney(Number(item.bonus || 0), currency)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatMoney(Number(item.ltcIncome || 0), currency)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatMoney(
                            Number(item.equityIncome || 0),
                            currency,
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-orange-600">
                          {formatMoney(
                            Number(item.socialInsurance || 0),
                            currency,
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-orange-600">
                          {formatMoney(Number(item.housingFund || 0), currency)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-red-600">
                          {formatMoney(Number(item.incomeTax || 0), currency)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatMoney(
                            Number(item.taxableIncome || 0),
                            currency,
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatMoney(
                            Number(item.taxableCumulative || 0),
                            currency,
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatMoney(
                            Number(item.taxCumulative || 0),
                            currency,
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatMoney(Number(item.taxPaid || 0), currency)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {formatMoney(Number(item.netIncome || 0), currency)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
