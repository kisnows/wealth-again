"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface IncomeRecord {
  month: number;
  gross: number;
  bonus?: number;
  taxableCumulative: number;
  taxThisMonth: number;
  taxDueCumulative: number;
  net: number;
}

export default function IncomeForm() {
  const [city, setCity] = useState("Hangzhou");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [gross, setGross] = useState(20000);
  const [bonus, setBonus] = useState(0);
  const [forecast, setForecast] = useState<IncomeRecord[]>([]);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      // 保存收入记录
      await fetch("/api/income/monthly", {
        method: "POST",
        body: JSON.stringify({ city, year, month, gross, bonus }),
        headers: { "Content-Type": "application/json" },
      });
      
      // 获取预测结果
      const f = await fetch(`/api/income/forecast?city=${city}&year=${year}`);
      const data = await f.json();
      setForecast(data.results || []);
    } catch (error) {
      console.error("Error saving income:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>收入录入</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">城市</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="请输入城市"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">年份</Label>
              <Input
                id="year"
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="month">月份</Label>
              <Input
                id="month"
                type="number"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                min="1"
                max="12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gross">税前收入 (元)</Label>
              <Input
                id="gross"
                type="number"
                value={gross}
                onChange={(e) => setGross(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bonus">奖金 (元)</Label>
              <Input
                id="bonus"
                type="number"
                value={bonus}
                onChange={(e) => setBonus(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={submit} disabled={loading}>
              {loading ? "保存中..." : "保存并预测"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {forecast.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>累计预扣结果</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">月份</th>
                    <th className="text-left py-2">累计应税</th>
                    <th className="text-left py-2">本月税额</th>
                    <th className="text-left py-2">累计税额</th>
                    <th className="text-left py-2">税后收入</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.map((r) => (
                    <tr key={r.month} className="border-b">
                      <td className="py-2">{r.month}</td>
                      <td className="py-2">{formatCurrency(r.taxableCumulative)}</td>
                      <td className="py-2">{formatCurrency(r.taxThisMonth)}</td>
                      <td className="py-2">{formatCurrency(r.taxDueCumulative)}</td>
                      <td className="py-2">{formatCurrency(r.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}