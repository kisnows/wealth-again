"use client";

import { useEffect, useState } from "react";
import { IncomeForecastChart } from "@/components/income/forecast-chart";
import { CurrencyDisplay } from "@/components/shared/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface IncomeRecord {
  month: number;
  gross: number;
  bonus?: number;
  taxableCumulative: number;
  taxThisMonth: number;
  taxDueCumulative: number;
  net: number;
}

/**
 * 重构后的收入汇总组件
 * 职责单一：显示收入汇总数据和图表
 */
export default function IncomeSummary() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [records, setRecords] = useState<IncomeRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchIncomeSummary();
  }, [year]);

  async function fetchIncomeSummary() {
    setLoading(true);
    try {
      const res = await fetch(`/api/income/summary?year=${year}`);
      const data = await res.json();
      setRecords(data.records || []);
    } catch (error) {
      console.error("Error fetching income summary:", error);
    } finally {
      setLoading(false);
    }
  }

  // 准备图表数据
  const chartData = records.map((record) => ({
    ym: `${record.month}月`,
    taxBefore: record.gross,
    taxAfter: record.net,
  }));

  // 计算年度汇总
  const totals = {
    totalGross: records.reduce((sum, record) => sum + record.gross, 0),
    totalNet: records.reduce((sum, record) => sum + record.net, 0),
    totalTax: records.reduce((sum, record) => sum + record.taxThisMonth, 0),
    totalBonus: records.reduce((sum, record) => sum + (record.bonus || 0), 0),
  };

  const availableYears = [2023, 2024, 2025, 2026];

  return (
    <div className="space-y-6">
      {/* 页面标题和年份选择 */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">收入汇总报表</h2>
        <div className="flex items-center gap-2">
          <label htmlFor="year-select">年份:</label>
          <select
            id="year-select"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border rounded px-2 py-1"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 年度汇总卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">年度税前收入</CardTitle>
          </CardHeader>
          <CardContent>
            <CurrencyDisplay amount={totals.totalGross} className="text-2xl font-bold" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">年度奖金</CardTitle>
          </CardHeader>
          <CardContent>
            <CurrencyDisplay amount={totals.totalBonus} className="text-2xl font-bold" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">年度税额</CardTitle>
          </CardHeader>
          <CardContent>
            <CurrencyDisplay amount={totals.totalTax} className="text-2xl font-bold text-red-600" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">年度税后收入</CardTitle>
          </CardHeader>
          <CardContent>
            <CurrencyDisplay
              amount={totals.totalNet}
              className="text-2xl font-bold text-green-600"
            />
          </CardContent>
        </Card>
      </div>

      {/* 收入趋势图表 */}
      <Card>
        <CardHeader>
          <CardTitle>收入趋势</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="text-gray-500">加载中...</div>
            </div>
          ) : (
            <IncomeForecastChart
              data={chartData.map((item, index) => ({
                ...item,
                grossThisMonth: item.taxBefore,
                net: item.taxAfter,
                month: index + 1,
              }))}
              userBaseCurrency="CNY"
            />
          )}
        </CardContent>
      </Card>

      {/* 详细记录表格 */}
      <Card>
        <CardHeader>
          <CardTitle>月度详细记录</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">月份</th>
                  <th className="text-left py-2">税前收入</th>
                  <th className="text-left py-2">奖金</th>
                  <th className="text-left py-2">累计应税</th>
                  <th className="text-left py-2">本月税额</th>
                  <th className="text-left py-2">累计税额</th>
                  <th className="text-left py-2">税后收入</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      {loading ? "加载中..." : "暂无数据"}
                    </td>
                  </tr>
                ) : (
                  records.map((record) => (
                    <tr key={record.month} className="border-b">
                      <td className="py-2">{record.month}月</td>
                      <td className="py-2">
                        <CurrencyDisplay amount={record.gross} />
                      </td>
                      <td className="py-2">
                        {record.bonus ? <CurrencyDisplay amount={record.bonus} /> : "-"}
                      </td>
                      <td className="py-2">
                        <CurrencyDisplay amount={record.taxableCumulative} />
                      </td>
                      <td className="py-2">
                        <CurrencyDisplay amount={record.taxThisMonth} />
                      </td>
                      <td className="py-2">
                        <CurrencyDisplay amount={record.taxDueCumulative} />
                      </td>
                      <td className="py-2">
                        <CurrencyDisplay
                          amount={record.net}
                          className="text-green-600 font-medium"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
