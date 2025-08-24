"use client";

import {
  BarChart3,
  Calendar,
  DollarSign,
  ExternalLink,
  PieChart,
  Settings,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { IncomeForecastChart } from "@/components/income/forecast-chart";
import { IncomeForecastTable } from "@/components/income/forecast-table";
import { UnifiedIncomeManager } from "@/components/income/unified-income-manager";
import { CurrencyDisplay, CurrencySelect } from "@/components/shared/currency";
import { MessagesContainer } from "@/components/shared/messages";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useIncomeData, useUserConfig } from "@/hooks/use-income-data";

export default function IncomePage() {
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    return {
      start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      end: `${now.getFullYear()}-${String(now.getMonth() + 12).padStart(2, "0")}`,
    };
  });

  const { baseCurrency, updateUserConfig } = useUserConfig();
  const { forecast, totals, loading, error, setError } = useIncomeData(dateRange);
  const [selectedCurrency, setSelectedCurrency] = useState(baseCurrency);

  const handleBaseCurrencyChange = (currency: string) => {
    updateUserConfig({ baseCurrency: currency });
  };

  const handleDataRefresh = () => {
    window.dispatchEvent(new CustomEvent("income:refresh"));
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">收入管理</h1>
          <p className="page-subtitle">统一管理工资、奖金和长期现金，精确预测财务未来</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Link href="/income/summary">
            <Button variant="outline" size="sm">
              <BarChart3 className="w-4 h-4 mr-2" />
              汇总报表
            </Button>
          </Link>
          <Link href="/tax">
            <Button variant="outline" size="sm">
              <PieChart className="w-4 h-4 mr-2" />
              税务分析
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="back-button">
              返回仪表板
            </Button>
          </Link>
        </div>
      </div>

      <MessagesContainer error={error} onClearError={() => setError("")} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-muted-foreground" />
            系统配置
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="text-sm font-semibold text-foreground mb-2 block">基准货币</Label>
              <CurrencySelect
                value={baseCurrency}
                onChange={handleBaseCurrencyChange}
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                data-testid="base-currency-select"
              />
              <p className="text-xs text-muted-foreground mt-1">影响所有金额的显示和计算</p>
            </div>

            <div>
              <Label className="text-sm font-semibold text-foreground mb-2 block">操作货币</Label>
              <CurrencySelect
                value={selectedCurrency}
                onChange={setSelectedCurrency}
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                data-testid="selected-currency-select"
              />
              <p className="text-xs text-muted-foreground mt-1">新增记录时使用的默认货币</p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-accent border border-border rounded-xl">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary rounded-lg">
                <Settings className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-accent-foreground mb-1">城市税务配置</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  工作城市影响社保公积金计算。收入数据本身与城市无关，系统会根据生效时间自动匹配相应的城市税务政策。
                </p>
                <Link href="/settings/city">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-primary border-border hover:bg-accent"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    城市管理设置
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <UnifiedIncomeManager userBaseCurrency={baseCurrency} onDataChange={handleDataRefresh} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
            收入预测分析
          </CardTitle>
          <p className="text-sm text-muted-foreground">基于历史数据和政策变动，预测未来收入趋势</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600 mb-1">总工资收入</p>
                    <CurrencyDisplay
                      amount={totals.totalSalary}
                      userBaseCurrency={baseCurrency}
                      className="text-2xl font-bold text-blue-700"
                      data-testid="total-salary-amount"
                    />
                  </div>
                  <div className="p-3 bg-blue-200 rounded-xl">
                    <DollarSign className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-amber-600 mb-1">奖金收入</p>
                    <CurrencyDisplay
                      amount={totals.totalBonus}
                      userBaseCurrency={baseCurrency}
                      className="text-2xl font-bold text-amber-700"
                      data-testid="total-bonus-amount"
                    />
                  </div>
                  <div className="p-3 bg-amber-200 rounded-xl">
                    <TrendingUp className="w-6 h-6 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-emerald-600 mb-1">长期现金</p>
                    <CurrencyDisplay
                      amount={totals.totalLongTermCash}
                      userBaseCurrency={baseCurrency}
                      className="text-2xl font-bold text-emerald-700"
                      data-testid="total-long-term-cash-amount"
                    />
                  </div>
                  <div className="p-3 bg-emerald-200 rounded-xl">
                    <Wallet className="w-6 h-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-violet-50 to-violet-100 border-violet-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-violet-600 mb-1">预计税后收入</p>
                    <CurrencyDisplay
                      amount={totals.totalNet}
                      userBaseCurrency={baseCurrency}
                      className="text-2xl font-bold text-violet-700"
                      data-testid="total-net-amount"
                    />
                  </div>
                  <div className="p-3 bg-violet-200 rounded-xl">
                    <PieChart className="w-6 h-6 text-violet-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-muted rounded-xl">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">预测区间：</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="month"
                className="flex h-10 w-36 rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={dateRange.start}
                onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
              />
              <span className="text-muted-foreground">至</span>
              <input
                type="month"
                className="flex h-10 w-36 rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={dateRange.end}
                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const year = new Date().getFullYear() - 1;
                  setDateRange({ start: `${year}-01`, end: `${year}-12` });
                }}
              >
                去年
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const year = new Date().getFullYear() - 2;
                  setDateRange({
                    start: `${year}-01`,
                    end: `${new Date().getFullYear() - 1}-12`,
                  });
                }}
              >
                去两年
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const now = new Date();
                  const year = now.getFullYear();
                  const month = now.getMonth() + 1;
                  setDateRange({
                    start: `${year}-01`,
                    end: `${year}-${String(month).padStart(2, "0")}`,
                  });
                }}
              >
                今年（截至目前）
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const year = new Date().getFullYear();
                  setDateRange({ start: `${year}-01`, end: `${year}-12` });
                }}
              >
                今年（整年）
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const year = new Date().getFullYear();
                  setDateRange({ start: `${year + 1}-01`, end: `${year + 2}-12` });
                }}
              >
                未来两年
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const year = new Date().getFullYear();
                  setDateRange({ start: `${year + 1}-01`, end: `${year + 3}-12` });
                }}
              >
                未来三年
              </Button>
            </div>
          </div>

          <div className="mb-8">
            <IncomeForecastChart data={forecast} userBaseCurrency={baseCurrency} />
          </div>

          <IncomeForecastTable data={forecast} userBaseCurrency={baseCurrency} />
        </CardContent>
      </Card>

      <div className="text-center py-6 border-t border-border">
        <p className="text-sm text-muted-foreground">
          数据更新时间：{new Date().toLocaleString("zh-CN")}
          <span className="mx-2">•</span>
          所有金额均以 {baseCurrency} 为基准显示
        </p>
      </div>
    </div>
  );
}