"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencySelect, CurrencyDisplay } from "@/components/ui/currency-display";
import { MessagesContainer } from "@/components/ui/messages";
import { SalaryChangeForm, BonusPlanForm } from "@/components/income/forms";
import { SalaryChangesTable, BonusPlansTable, LongTermCashTable } from "@/components/income/tables";
import { IncomeForecastChart } from "@/components/income/forecast-chart";
import { IncomeForecastTable } from "@/components/income/forecast-table";
import { useUserConfig, useIncomeData } from "@/hooks/use-income-data";
import LongTermCashForm from "@/components/income/long-term-cash-form";

/**
 * 重构后的收入管理主页面
 * 职责清晰：页面布局和组件组合
 */
export default function IncomePage() {
  // 日期范围状态
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    return {
      start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      end: `${now.getFullYear()}-${String(now.getMonth() + 12).padStart(2, "0")}`
    };
  });

  // 使用自定义hooks管理数据和状态
  const { baseCurrency, cities, updateUserConfig } = useUserConfig();
  const { 
    bonuses, 
    changes, 
    longTermCash, 
    forecast, 
    totals,
    loading, 
    error,
    setError 
  } = useIncomeData(dateRange);

  // 城市和货币状态
  const [selectedCity, setSelectedCity] = useState("Hangzhou");
  const [selectedCurrency, setSelectedCurrency] = useState(baseCurrency);

  const handleBaseCurrencyChange = (currency: string) => {
    updateUserConfig({ baseCurrency: currency });
  };

  const handleAddLongTermCash = async (data: any) => {
    try {
      const response = await fetch("/api/income/long-term-cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error?.message || "添加失败");
      }

      // 触发刷新
      window.dispatchEvent(new CustomEvent("income:refresh"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加失败");
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* 页面标题 */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">个人收入管理</h1>
        <Link href="/income/summary">
          <Button variant="outline">查看汇总报表</Button>
        </Link>
      </div>

      {/* 消息提示 */}
      <MessagesContainer error={error} onClearError={() => setError("")} />

      {/* 用户设置 */}
      <Card>
        <CardHeader>
          <CardTitle>基本设置</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>基准币种</Label>
              <CurrencySelect 
                value={baseCurrency} 
                onChange={handleBaseCurrencyChange}
              />
            </div>
            <div className="space-y-2">
              <Label>工作城市</Label>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="border rounded px-3 py-2 w-full"
              >
                {cities.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>操作币种</Label>
              <CurrencySelect 
                value={selectedCurrency} 
                onChange={setSelectedCurrency}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 表单区域 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SalaryChangeForm
          city={selectedCity}
          currency={selectedCurrency}
          onCurrencyChange={setSelectedCurrency}
        />
        <BonusPlanForm
          city={selectedCity}
          currency={selectedCurrency}
          onCurrencyChange={setSelectedCurrency}
        />
      </div>

      {/* 长期现金表单 */}
      <LongTermCashForm onAdd={handleAddLongTermCash} />

      {/* 数据表格区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalaryChangesTable data={changes} userBaseCurrency={baseCurrency} />
        <BonusPlansTable data={bonuses} userBaseCurrency={baseCurrency} />
      </div>

      <LongTermCashTable data={longTermCash} userBaseCurrency={baseCurrency} />

      {/* 收入预测区域 */}
      <Card>
        <CardHeader>
          <CardTitle>收入预测分析</CardTitle>
        </CardHeader>
        <CardContent>
          {/* 汇总信息 */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            <div className="text-center">
              <div className="text-sm text-gray-600">总工资</div>
              <CurrencyDisplay 
                amount={totals.totalSalary} 
                userBaseCurrency={baseCurrency}
                className="text-lg font-semibold"
              />
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">总奖金</div>
              <CurrencyDisplay 
                amount={totals.totalBonus} 
                userBaseCurrency={baseCurrency}
                className="text-lg font-semibold"
              />
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">长期现金</div>
              <CurrencyDisplay 
                amount={totals.totalLongTermCash} 
                userBaseCurrency={baseCurrency}
                className="text-lg font-semibold"
              />
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">总税前</div>
              <CurrencyDisplay 
                amount={totals.totalGross} 
                userBaseCurrency={baseCurrency}
                className="text-lg font-semibold text-blue-600"
              />
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">总税收</div>
              <CurrencyDisplay 
                amount={totals.totalTax} 
                userBaseCurrency={baseCurrency}
                className="text-lg font-semibold text-red-600"
              />
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">总税后</div>
              <CurrencyDisplay 
                amount={totals.totalNet} 
                userBaseCurrency={baseCurrency}
                className="text-lg font-semibold text-green-600"
              />
            </div>
          </div>

          {/* 日期范围选择器 */}
          <div className="flex gap-4 mb-6 items-center flex-wrap">
            <span>预测区间：</span>
            <div className="flex items-center gap-2">
              <input
                type="month"
                className="border rounded px-2 py-1"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              />
              <span>至</span>
              <input
                type="month"
                className="border rounded px-2 py-1"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              />
            </div>
            {/* 快捷选择按钮 */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const year = new Date().getFullYear();
                  setDateRange({ start: `${year}-01`, end: `${year}-12` });
                }}
              >
                今年
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const year = new Date().getFullYear();
                  setDateRange({ start: `${year + 1}-01`, end: `${year + 2}-12` });
                }}
              >
                未来两年
              </Button>
            </div>
          </div>

          {/* 图表 */}
          <IncomeForecastChart data={forecast} userBaseCurrency={baseCurrency} />

          {/* 详细表格 */}
          <IncomeForecastTable data={forecast} userBaseCurrency={baseCurrency} />
        </CardContent>
      </Card>
    </div>
  );
}