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

/**
 * 现代化个人收入管理主页面
 *
 * 功能特性：
 * - 统一的收入记录管理（工资、奖金、长期现金）
 * - 现代化UI设计和配色方案
 * - 实时收入预测和可视化分析
 * - 多货币支持和汇率转换
 * - 响应式布局设计
 */
export default function IncomePage() {
  // ==================== 状态管理 ====================
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

  // ==================== 事件处理函数 ====================
  const handleBaseCurrencyChange = (currency: string) => {
    updateUserConfig({ baseCurrency: currency });
  };

  const handleDataRefresh = () => {
    // 触发数据刷新
    window.dispatchEvent(new CustomEvent("income:refresh"));
  };

  // ==================== 页面渲染 ====================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto py-8 space-y-8">
        {/* ==================== 页面头部 ==================== */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              收入管理中心
            </h1>
            <p className="text-slate-600 text-lg">统一管理工资、奖金和长期现金，精确预测财务未来</p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/income/summary">
              <Button variant="outline" className="wealth-button-secondary">
                <BarChart3 className="w-4 h-4 mr-2" />
                汇总报表
              </Button>
            </Link>
            <Link href="/tax">
              <Button variant="outline" className="wealth-button-secondary">
                <PieChart className="w-4 h-4 mr-2" />
                税务分析
              </Button>
            </Link>
          </div>
        </div>

        {/* ==================== 消息提示区域 ==================== */}
        <MessagesContainer error={error} onClearError={() => setError("")} />

        {/* ==================== 快速统计概览 ==================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="wealth-card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
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

          <Card className="wealth-card bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
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

          <Card className="wealth-card bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
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

          <Card className="wealth-card bg-gradient-to-br from-violet-50 to-violet-100 border-violet-200">
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

        {/* ==================== 系统配置区域 ==================== */}
        <Card className="wealth-card">
          <CardHeader className="wealth-card-header">
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-slate-600" />
              系统配置
            </CardTitle>
          </CardHeader>
          <CardContent className="wealth-card-content">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="text-sm font-semibold text-slate-700 mb-2 block">基准货币</Label>
                <CurrencySelect
                  value={baseCurrency}
                  onChange={handleBaseCurrencyChange}
                  className="wealth-input"
                  data-testid="base-currency-select"
                />
                <p className="text-xs text-slate-500 mt-1">影响所有金额的显示和计算</p>
              </div>

              <div>
                <Label className="text-sm font-semibold text-slate-700 mb-2 block">操作货币</Label>
                <CurrencySelect
                  value={selectedCurrency}
                  onChange={setSelectedCurrency}
                  className="wealth-input"
                  data-testid="selected-currency-select"
                />
                <p className="text-xs text-slate-500 mt-1">新增记录时使用的默认货币</p>
              </div>
            </div>

            {/* 城市管理提示 */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Settings className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-blue-800 mb-1">城市税务配置</h4>
                  <p className="text-sm text-blue-700 mb-3">
                    工作城市影响社保公积金计算。收入数据本身与城市无关，系统会根据生效时间自动匹配相应的城市税务政策。
                  </p>
                  <Link href="/settings/city">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-blue-600 border-blue-300 hover:bg-blue-100"
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

        {/* ==================== 统一收入记录管理 ==================== */}
        <UnifiedIncomeManager userBaseCurrency={baseCurrency} onDataChange={handleDataRefresh} />

        {/* ==================== 收入预测分析区域 ==================== */}
        <Card className="wealth-card">
          <CardHeader className="wealth-card-header">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-slate-600" />
              收入预测分析
            </CardTitle>
            <p className="text-sm text-slate-600">基于历史数据和政策变动，预测未来收入趋势</p>
          </CardHeader>
          <CardContent className="wealth-card-content">
            {/* ==================== 预测时间范围选择器 ==================== */}
            <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-700">预测区间：</span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="month"
                  className="wealth-input text-sm w-36"
                  value={dateRange.start}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                />
                <span className="text-slate-500">至</span>
                <input
                  type="month"
                  className="wealth-input text-sm w-36"
                  value={dateRange.end}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const year = new Date().getFullYear();
                    setDateRange({ start: `${year}-01`, end: `${year}-12` });
                  }}
                  className="wealth-button-secondary"
                >
                  今年
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const year = new Date().getFullYear();
                    setDateRange({ start: `${year + 1}-01`, end: `${year + 2}-12` });
                  }}
                  className="wealth-button-secondary"
                >
                  未来两年
                </Button>
              </div>
            </div>

            {/* ==================== 预测图表展示 ==================== */}
            <div className="mb-8">
              <IncomeForecastChart data={forecast} userBaseCurrency={baseCurrency} />
            </div>

            {/* ==================== 预测详细数据表格 ==================== */}
            <IncomeForecastTable data={forecast} userBaseCurrency={baseCurrency} />
          </CardContent>
        </Card>

        {/* ==================== 页面底部信息 ==================== */}
        <div className="text-center py-6 border-t border-slate-200">
          <p className="text-sm text-slate-500">
            数据更新时间：{new Date().toLocaleString("zh-CN")}
            <span className="mx-2">•</span>
            所有金额均以 {baseCurrency} 为基准显示
          </p>
        </div>
      </div>
    </div>
  );
}
