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
 * 个人收入管理主页面
 * 
 * 功能概述：
 * - 提供收入数据管理的统一界面
 * - 支持薪资变更、奖金计划、长期现金等收入类型管理  
 * - 实时收入预测和可视化分析
 * - 多货币支持和汇率转换
 * - 城市信息通过用户城市历史管理，社保公积金计算时动态查询
 * 
 * 页面组成：
 * 1. 基本设置区域 - 基准货币、操作币种选择
 * 2. 数据录入表单 - 薪资变更表单、奖金计划表单、长期现金表单
 * 3. 数据展示表格 - 历史记录表格展示
 * 4. 预测分析区域 - 图表和表格展示收入预测
 * 
 * 重构说明：
 * - 将原来800+行的巨型组件拆分为多个小组件
 * - 使用自定义hooks管理复杂的状态逻辑
 * - 统一的错误处理和消息提示
 * - 清晰的组件职责分离
 * - 城市架构重构：城市只影响社保公积金计算，收入数据本身与城市无关
 */
export default function IncomePage() {
  // ==================== 状态管理 ====================
  
  /**
   * 收入预测日期范围状态
   * 默认从当前月开始，预测一年
   */
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    return {
      start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      end: `${now.getFullYear()}-${String(now.getMonth() + 12).padStart(2, "0")}`
    };
  });

  /**
   * 使用自定义hooks管理用户配置和收入数据
   * - useUserConfig: 管理用户基本配置（货币等）
   * - useIncomeData: 管理收入相关数据的获取和更新
   */
  const { baseCurrency, updateUserConfig } = useUserConfig();
  const { 
    bonuses,        // 奖金计划数据
    changes,        // 薪资变更数据
    longTermCash,   // 长期现金数据
    forecast,       // 收入预测数据
    totals,         // 汇总统计数据
    loading,        // 加载状态
    error,          // 错误信息
    setError        // 错误设置函数
  } = useIncomeData(dateRange);

  /**
   * 当前选择的操作币种状态
   * 用于表单提交时的币种选择
   */
  const [selectedCurrency, setSelectedCurrency] = useState(baseCurrency);

  // ==================== 事件处理函数 ====================

  /**
   * 处理基准货币变更
   * 更新用户配置并触发相关数据重新计算
   */
  const handleBaseCurrencyChange = (currency: string) => {
    updateUserConfig({ baseCurrency: currency });
  };

  /**
   * 处理长期现金添加
   * 调用API创建长期现金计划，成功后触发数据刷新
   * @param data - 长期现金数据（总金额、生效日期、货币）
   */
  const handleAddLongTermCash = async (data: any) => {
    try {
      console.log("正在添加长期现金:", data);
      
      const response = await fetch("/api/income/long-term-cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      console.log("API响应:", result);
      
      if (!result.success) {
        throw new Error(result.error?.message || result.error?.details || "添加失败");
      }

      // 触发数据刷新事件，通知其他组件更新数据
      window.dispatchEvent(new CustomEvent("income:refresh"));
      
      console.log("长期现金添加成功");
    } catch (err) {
      console.error("添加长期现金失败:", err);
      setError(err instanceof Error ? err.message : "添加失败");
    }
  };

  // ==================== 页面渲染 ====================

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* ==================== 页面标题区域 ==================== */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">个人收入管理</h1>
        {/* 快捷导航到汇总报表页面 */}
        <Link href="/income/summary">
          <Button variant="outline">查看汇总报表</Button>
        </Link>
      </div>

      {/* ==================== 消息提示区域 ==================== */}
      {/* 统一的错误和成功消息显示组件 */}
      <MessagesContainer error={error} onClearError={() => setError("")} />

      {/* ==================== 基本设置区域 ==================== */}
      <Card>
        <CardHeader>
          <CardTitle>基本设置</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 基准货币选择 - 影响所有金额的显示和计算 */}
            <div className="space-y-2">
              <Label>基准货币</Label>
              <CurrencySelect 
                value={baseCurrency} 
                onChange={handleBaseCurrencyChange}
              />
            </div>
            
            {/* 操作币种选择 - 影响当前操作的表单币种 */}
            <div className="space-y-2">
              <Label>操作币种</Label>
              <CurrencySelect 
                value={selectedCurrency} 
                onChange={setSelectedCurrency}
              />
            </div>
          </div>
          
          {/* 城市管理提示 */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-start space-x-2">
              <div className="text-blue-600 text-sm">
                💡 <strong>城市管理：</strong>工作城市影响社保公积金计算。如需更改工作城市，请前往{" "}
                <Link href="/settings/city" className="underline font-medium">
                  城市管理
                </Link>{" "}
                页面进行设置。
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ==================== 数据录入表单区域 ==================== */}
      {/* 薪资变更和奖金计划表单并排显示 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 薪资变更表单 - 用于记录月薪调整，与城市无关 */}
        <SalaryChangeForm
          currency={selectedCurrency}
          onCurrencyChange={setSelectedCurrency}
        />
        
        {/* 奖金计划表单 - 用于记录季度/年度奖金计划，与城市无关 */}
        <BonusPlanForm
          currency={selectedCurrency}
          onCurrencyChange={setSelectedCurrency}
        />
      </div>

      {/* 长期现金表单 - 用于记录分期发放的长期激励，与城市无关 */}
      <LongTermCashForm onAdd={handleAddLongTermCash} />

      {/* ==================== 数据展示表格区域 ==================== */}
      {/* 历史数据表格并排显示 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 薪资变更历史记录表格 */}
        <SalaryChangesTable data={changes} userBaseCurrency={baseCurrency} />
        
        {/* 奖金计划历史记录表格 */}
        <BonusPlansTable data={bonuses} userBaseCurrency={baseCurrency} />
      </div>

      {/* 长期现金历史记录表格 - 独占一行显示 */}
      <LongTermCashTable data={longTermCash} userBaseCurrency={baseCurrency} />

      {/* ==================== 收入预测分析区域 ==================== */}
      <Card>
        <CardHeader>
          <CardTitle>收入预测分析</CardTitle>
        </CardHeader>
        <CardContent>
          {/* ==================== 汇总信息展示 ==================== */}
          {/* 6个关键指标的汇总展示 */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            {/* 总工资 - 预测期内的工资总额 */}
            <div className="text-center">
              <div className="text-sm text-gray-600">总工资</div>
              <CurrencyDisplay 
                amount={totals.totalSalary} 
                userBaseCurrency={baseCurrency}
                className="text-lg font-semibold"
              />
            </div>
            
            {/* 总奖金 - 预测期内的奖金总额 */}
            <div className="text-center">
              <div className="text-sm text-gray-600">总奖金</div>
              <CurrencyDisplay 
                amount={totals.totalBonus} 
                userBaseCurrency={baseCurrency}
                className="text-lg font-semibold"
              />
            </div>
            
            {/* 长期现金 - 预测期内的长期现金总额 */}
            <div className="text-center">
              <div className="text-sm text-gray-600">长期现金</div>
              <CurrencyDisplay 
                amount={totals.totalLongTermCash} 
                userBaseCurrency={baseCurrency}
                className="text-lg font-semibold"
              />
            </div>
            
            {/* 总税前收入 - 所有税前收入汇总 */}
            <div className="text-center">
              <div className="text-sm text-gray-600">总税前</div>
              <CurrencyDisplay 
                amount={totals.totalGross} 
                userBaseCurrency={baseCurrency}
                className="text-lg font-semibold text-blue-600"
              />
            </div>
            
            {/* 总税收 - 预计缴纳的税费总额 */}
            <div className="text-center">
              <div className="text-sm text-gray-600">总税收</div>
              <CurrencyDisplay 
                amount={totals.totalTax} 
                userBaseCurrency={baseCurrency}
                className="text-lg font-semibold text-red-600"
              />
            </div>
            
            {/* 总税后收入 - 实际到手收入总额 */}
            <div className="text-center">
              <div className="text-sm text-gray-600">总税后</div>
              <CurrencyDisplay 
                amount={totals.totalNet} 
                userBaseCurrency={baseCurrency}
                className="text-lg font-semibold text-green-600"
              />
            </div>
          </div>

          {/* ==================== 预测时间范围选择器 ==================== */}
          <div className="flex gap-4 mb-6 items-center flex-wrap">
            <span>预测区间：</span>
            
            {/* 开始和结束月份选择器 */}
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
              {/* 今年按钮 - 快速选择当前年度 */}
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
              
              {/* 未来两年按钮 - 快速选择未来两年 */}
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

          {/* ==================== 预测图表展示 ==================== */}
          {/* 收入预测的可视化图表 - 显示月度收入趋势 */}
          <IncomeForecastChart data={forecast} userBaseCurrency={baseCurrency} />

          {/* ==================== 预测详细数据表格 ==================== */}
          {/* 收入预测的详细数据表格 - 显示每月具体数据 */}
          <IncomeForecastTable data={forecast} userBaseCurrency={baseCurrency} />
        </CardContent>
      </Card>
    </div>
  );
}