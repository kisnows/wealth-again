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

export default function IncomePage() {
  const [bonuses, setBonuses] = useState<any[]>([]);
  const [changes, setChanges] = useState<any[]>([]);
  const [months, setMonths] = useState(12);
  const [forecast, setForecast] = useState<any[]>([]);
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
      fetch(`/api/income/forecast?start=${startYM}&end=${endYM}`).then((r) => r.json()),
    ]);
    setBonuses(b.records || []);
    setChanges(c.records || []);
    setForecast((f.results || []).map((x: any) => ({ ...x })));
    setTotals(f.totals || { totalSalary:0,totalBonus:0,totalGross:0,totalNet:0,totalTax:0 });
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
  }, [months, startYM, endYM]);

  const [totals, setTotals] = useState<any>({ totalSalary:0,totalBonus:0,totalGross:0,totalNet:0,totalTax:0 });
  const chartData = useMemo(() => {
    const arr = forecast
      .map((r: any) => ({
        ym: r.ym || `${new Date().getFullYear()}-${String(r.month).padStart(2, "0")}`,
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
        <Link href="/income/summary"><Button variant="outline">查看汇总报表</Button></Link>
      </div>
      <IncomeForm />

      <Card>
        <CardHeader><CardTitle>工资变更记录（最近）</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b"><th className="text-left py-2">生效日期</th><th className="text-left py-2">月薪</th></tr></thead>
              <tbody>
                {changes.map((r)=> (
                  <tr key={r.id} className="border-b"><td className="py-2">{new Date(r.effectiveFrom).toLocaleDateString()}</td><td className="py-2">¥{Number(r.grossMonthly).toLocaleString()}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>奖金计划（最近）</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b"><th className="text-left py-2">生效日期</th><th className="text-left py-2">金额</th></tr></thead>
              <tbody>
                {bonuses.map((r)=> (
                  <tr key={r.id} className="border-b"><td className="py-2">{new Date(r.effectiveDate).toLocaleDateString()}</td><td className="py-2">¥{Number(r.amount).toLocaleString()}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>收入预测</CardTitle></CardHeader>
        <CardContent>
          <div className="mb-2 text-sm text-gray-600">
            总工资收入：¥{totals.totalSalary.toLocaleString()} ｜ 总奖金收入：¥{totals.totalBonus.toLocaleString()} ｜ 总税前：¥{totals.totalGross.toLocaleString()} ｜ 总税收：¥{totals.totalTax.toLocaleString()} ｜ 总税后：¥{totals.totalNet.toLocaleString()}
          </div>
          <div className="flex gap-4 mb-4 items-center flex-wrap">
            <span>预测区间：</span>
            <select
              className="border rounded px-2 py-1"
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
            >
              <option value={3}>3 个月</option>
              <option value={6}>6 个月</option>
              <option value={12}>12 个月</option>
              <option value={36}>3 年</option>
            </select>
            <div className="flex items-center gap-2">
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
              <Button
                variant="outline"
                onClick={() => {
                  const d = new Date();
                  const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                  const e = new Date(d);
                  e.setMonth(d.getMonth() + months - 1);
                  const end = `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}`;
                  setStartYM(s);
                  setEndYM(end);
                }}
              >
                应用快捷区间
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b"><th className="text-left py-2">月份</th><th className="text-left py-2">税前</th><th className="text-left py-2">税后</th><th className="text-left py-2">标注</th></tr></thead>
              <tbody>
                {forecast.map((r:any)=> (
                  <tr key={r.month} className="border-b">
                    <td className="py-2">{r.ym || `${new Date().getFullYear()}-${String(r.month).padStart(2, "0")}`}</td>
                    <td className="py-2">¥{Number(r.grossThisMonth||0).toLocaleString()}</td>
                    <td className="py-2">¥{Number(r.net||0).toLocaleString()}</td>
                    <td className="py-2 text-sm text-gray-600">{[r.markers?.salaryChange?"工资变动":null, r.markers?.bonusPaid?"奖金":null, r.markers?.taxChange?"税务调整":null].filter(Boolean).join(" / ")||"-"}</td>
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
                  <Bar dataKey="taxBefore" name="税前" fill="#8884d8" />
                  <Bar dataKey="taxAfter" name="税后" fill="#82ca9d" />
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
                  <Line type="monotone" dataKey="cumBefore" name="累计税前" stroke="#8884d8" />
                  <Line type="monotone" dataKey="cumAfter" name="累计税后" stroke="#82ca9d" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
