"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface IncomeRecord {
  month: number;
  gross: number;
  bonus?: number;
  taxableCumulative: number;
  taxThisMonth: number;
  taxDueCumulative: number;
  net: number;
}

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
  const chartData = records.map(record => ({
    month: `${record.month}月`,
    税前收入: record.gross,
    税后收入: record.net,
    税额: record.taxThisMonth,
  }));

  // 计算年度汇总
  const totalGross = records.reduce((sum, record) => sum + record.gross, 0);
  const totalNet = records.reduce((sum, record) => sum + record.net, 0);
  const totalTax = records.reduce((sum, record) => sum + record.taxThisMonth, 0);
  const totalBonus = records.reduce((sum, record) => sum + (record.bonus || 0), 0);

  return (
    <div className="space-y-6">
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
            {[2023, 2024, 2025, 2026].map(y => (
              <option key={y} value={y}>{y}</option>
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
            <div className="text-2xl font-bold">{formatCurrency(totalGross)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">年度奖金</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBonus)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">年度税额</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalTax)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">年度税后收入</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalNet)}</div>
          </CardContent>
        </Card>
      </div>

      {/* 收入趋势图表 */}
      <Card>
        <CardHeader>
          <CardTitle>收入趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="税前收入" fill="#8884d8" />
                <Bar dataKey="税后收入" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
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
                {records.map((record) => (
                  <tr key={record.month} className="border-b">
                    <td className="py-2">{record.month}月</td>
                    <td className="py-2">{formatCurrency(record.gross)}</td>
                    <td className="py-2">{record.bonus ? formatCurrency(record.bonus) : "-"}</td>
                    <td className="py-2">{formatCurrency(record.taxableCumulative)}</td>
                    <td className="py-2">{formatCurrency(record.taxThisMonth)}</td>
                    <td className="py-2">{formatCurrency(record.taxDueCumulative)}</td>
                    <td className="py-2">{formatCurrency(record.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}