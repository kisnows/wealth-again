"use client";
import Link from "next/link";
import IncomeForm from "@/components/income/income-form";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { formatCurrencyWithSeparator } from "@/lib/currency";

export default function IncomePage() {
  const [bonuses, setBonuses] = useState<any[]>([]);
  const [changes, setChanges] = useState<any[]>([]);
  const [forecast, setForecast] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [startYM, setStartYM] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [endYM, setEndYM] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 11);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  async function load() {
    const [b, c, f] = await Promise.all([
      fetch(`/api/income/bonus?page=1&pageSize=50`).then((r) => r.json()),
      fetch(`/api/income/changes?page=1&pageSize=50`).then((r) => r.json()),
      fetch(`/api/income/forecast?start=${startYM}&end=${endYM}`).then((r) =>
        r.json()
      ),
    ]);
    // 修复奖金API返回结构不一致的问题
    setBonuses(b.success ? b.data || [] : b.records || []);
    setChanges(c.records || []);
    setForecast((f.results || []).map((x: any) => ({ ...x })));
    setTotals(
      f.totals || {
        totalSalary: 0,
        totalBonus: 0,
        totalGross: 0,
        totalNet: 0,
        totalTax: 0,
      }
    );
  }

  async function deleteIncomeChange(id: string) {
    if (!confirm("确定要删除这条工资变更记录吗？")) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/income/changes?id=${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error?.message || "删除工资变更记录失败");
        return;
      }

      setSuccess("工资变更记录删除成功");
      // 重新加载数据
      await load();

      // 通知其他组件刷新
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("income:refresh"));
      }
    } catch (error) {
      console.error("Error deleting income change:", error);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function deleteBonusPlan(id: string) {
    if (!confirm("确定要删除这条奖金计划吗？")) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/income/bonus?id=${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error?.message || "删除奖金计划失败");
        return;
      }

      setSuccess("奖金计划删除成功");
      // 重新加载数据
      await load();

      // 通知其他组件刷新
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("income:refresh"));
      }
    } catch (error) {
      console.error("Error deleting bonus plan:", error);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const handler = () => load();
    if (typeof window !== "undefined") {
      window.addEventListener("income:refresh", handler);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("income:refresh", handler);
      }
    };
  }, [startYM, endYM]);

  const [totals, setTotals] = useState<any>({
    totalSalary: 0,
    totalBonus: 0,
    totalGross: 0,
    totalNet: 0,
    totalTax: 0,
  });
  const chartData = useMemo(() => {
    const arr = forecast
      .map((r: any) => ({
        ym:
          r.ym ||
          `${new Date().getFullYear()}-${String(r.month).padStart(2, "0")}`,
        taxBefore: Number(r.grossThisMonth || 0),
        taxAfter: Number(r.net || 0),
      }))
      .sort((a: any, b: any) => a.ym.localeCompare(b.ym));
    return arr;
  }, [forecast]);

  const cumulativeData = useMemo(() => {
    let cg = 0;
    let cn = 0;
    return chartData.map((x: any) => {
      cg += x.taxBefore;
      cn += x.taxAfter;
      return { ym: x.ym, cumBefore: cg, cumAfter: cn };
    });
  }, [chartData]);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">个人收入管理</h1>
        <Link href="/income/summary">
          <Button variant="outline">查看汇总报表</Button>
        </Link>
      </div>

      {/* 消息提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      <IncomeForm />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>工资变更记录（最近）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">生效日期</th>
                    <th className="text-left py-2">月薪</th>
                    <th className="text-left py-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((r) => (
                    <tr key={r.id} className="border-b">
                      <td className="py-2">
                        {new Date(r.effectiveFrom).toLocaleDateString()}
                      </td>
                      <td className="py-2">
                        {formatCurrencyWithSeparator(r.grossMonthly)}
                      </td>
                      <td className="py-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteIncomeChange(r.id)}
                          disabled={loading}
                        >
                          删除
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>奖金计划（最近）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">生效日期</th>
                    <th className="text-left py-2">金额</th>
                    <th className="text-left py-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {bonuses.map((r) => (
                    <tr key={r.id} className="border-b">
                      <td className="py-2">
                        {new Date(r.effectiveDate).toLocaleDateString()}
                      </td>
                      <td className="py-2">
                        {formatCurrencyWithSeparator(r.amount)}
                      </td>
                      <td className="py-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteBonusPlan(r.id)}
                          disabled={loading}
                        >
                          删除
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>收入预测</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-2 text-sm text-gray-600">
            总工资收入：{formatCurrencyWithSeparator(totals.totalSalary)} ｜
            总奖金收入：{formatCurrencyWithSeparator(totals.totalBonus)} ｜
            总税前：{formatCurrencyWithSeparator(totals.totalGross)} ｜ 总税收：
            {formatCurrencyWithSeparator(totals.totalTax)} ｜ 总税后：
            {formatCurrencyWithSeparator(totals.totalNet)}
          </div>
          <div className="flex gap-4 mb-4 items-center flex-wrap">
            <span>预测区间：</span>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const d = new Date();
                  const currentYear = d.getFullYear();
                  setStartYM(`${currentYear - 3}-01`);
                  setEndYM(`${currentYear}-12`);
                }}
              >
                过去三年
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const d = new Date();
                  const currentYear = d.getFullYear();
                  setStartYM(`${currentYear - 2}-01`);
                  setEndYM(`${currentYear}-12`);
                }}
              >
                过去两年
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const d = new Date();
                  const currentYear = d.getFullYear();
                  setStartYM(`${currentYear - 1}-01`);
                  setEndYM(`${currentYear - 1}-12`);
                }}
              >
                去年
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const d = new Date();
                  const currentYear = d.getFullYear();
                  const currentMonth = String(d.getMonth() + 1).padStart(
                    2,
                    "0"
                  );
                  setStartYM(`${currentYear}-01`);
                  setEndYM(`${currentYear}-${currentMonth}`);
                }}
              >
                今年
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const d = new Date();
                  const currentYear = d.getFullYear();
                  setStartYM(`${currentYear + 1}-01`);
                  setEndYM(`${currentYear + 1}-12`);
                }}
              >
                明年
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const d = new Date();
                  const currentYear = d.getFullYear();
                  setStartYM(`${currentYear + 1}-01`);
                  setEndYM(`${currentYear + 3}-12`);
                }}
              >
                未来三年
              </Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span>开始</span>
              <input
                type="month"
                className="border rounded px-2 py-1"
                value={startYM}
                onChange={(e) => setStartYM(e.target.value)}
              />
              <span>结束</span>
              <input
                type="month"
                className="border rounded px-2 py-1"
                value={endYM}
                onChange={(e) => setEndYM(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">月份</th>
                  <th className="text-left py-2">税前总收入</th>
                  <th className="text-left py-2">累计总收入</th>
                  <th className="text-left py-2">社保</th>
                  <th className="text-left py-2">税</th>
                  <th className="text-left py-2">税后总收入</th>
                  <th className="text-left py-2">工资</th>
                  <th className="text-left py-2">奖金</th>
                  <th className="text-left py-2">适用税率</th>
                  <th className="text-left py-2">备注</th>
                </tr>
              </thead>
              <tbody>
                {forecast.map((r: any) => (
                  <tr key={r.month} className="border-b">
                    <td className="py-2">
                      {r.ym ||
                        `${new Date().getFullYear()}-${String(r.month).padStart(
                          2,
                          "0"
                        )}`}
                    </td>
                    <td className="py-2 font-semibold">
                      {formatCurrencyWithSeparator(r.grossThisMonth)}
                    </td>
                    <td className="py-2">
                      {formatCurrencyWithSeparator(r.cumulativeIncome)}
                    </td>
                    <td className="py-2 text-blue-600">
                      {formatCurrencyWithSeparator(r.totalDeductionsThisMonth)}
                    </td>
                    <td className="py-2 text-red-600">
                      {formatCurrencyWithSeparator(r.taxThisMonth)}
                    </td>
                    <td className="py-2 font-semibold text-green-600">
                      {formatCurrencyWithSeparator(r.net)}
                    </td>
                    <td className="py-2">
                      {formatCurrencyWithSeparator(r.salaryThisMonth)}
                    </td>
                    <td className="py-2 font-medium text-orange-600">
                      {r.bonusThisMonth && Number(r.bonusThisMonth) > 0
                        ? formatCurrencyWithSeparator(r.bonusThisMonth)
                        : "-"}
                    </td>
                    <td className="py-2">
                      {r.appliedTaxRate != null
                        ? `${Number(r.appliedTaxRate).toFixed(2)}%`
                        : "-"}
                    </td>
                    <td className="py-2 text-sm text-gray-600">
                      {[
                        r.markers?.salaryChange ? "工资变动" : null,
                        r.markers?.bonusPaid ? "奖金" : null,
                        r.markers?.taxChange ? "税务调整" : null,
                      ]
                        .filter(Boolean)
                        .join(" / ") || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="ym" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="taxBefore" name="税前总收入" fill="#8884d8" />
                  <Bar dataKey="taxAfter" name="税后总收入" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cumulativeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="ym" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="cumBefore"
                    name="累计税前收入"
                    stroke="#8884d8"
                  />
                  <Line
                    type="monotone"
                    dataKey="cumAfter"
                    name="累计税后收入"
                    stroke="#82ca9d"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
