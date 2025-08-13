"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export default function IncomeForm() {
  const { data: session } = useSession();
  const [city, setCity] = useState("Hangzhou");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [gross, setGross] = useState(20000);
  const [bonus, setBonus] = useState(0);
  const [bonusDate, setBonusDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [forecast, setForecast] = useState<IncomeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit() {
    if (!session) return;
    
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // 保存收入记录
      const response = await fetch("/api/income/monthly", {
        method: "POST",
        body: JSON.stringify({ city, year, month, gross, bonus }),
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error?.message || "保存失败");
        return;
      }

      setSuccess("收入记录保存成功");
      
      // 获取预测结果
      const forecastResponse = await fetch(`/api/income/forecast?city=${city}&year=${year}`);
      const forecastData = await forecastResponse.json();
      
      if (forecastData.success) {
        setForecast(forecastData.data?.results || []);
      }

      // 通知其他组件刷新
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("income:refresh"));
      }

    } catch (error) {
      console.error("Error saving income:", error);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function addBonus() {
    if (!session) return;
    
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/income/bonus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          city, 
          amount: bonus, 
          effectiveDate: bonusDate 
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error?.message || "添加奖金计划失败");
        return;
      }

      setSuccess("奖金计划添加成功");
      setBonus(0); // 重置奖金输入

      // 通知其他组件刷新
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("income:refresh"));
      }

    } catch (error) {
      console.error("Error adding bonus:", error);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  if (!session) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-gray-500">请先登录以使用此功能</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>收入录入</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          
          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              {success}
            </div>
          )}

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
            <div className="space-y-2">
              <Label htmlFor="bonusDate">奖金发放日</Label>
              <Input 
                id="bonusDate" 
                type="date" 
                value={bonusDate} 
                onChange={(e)=> setBonusDate(e.target.value)} 
              />
            </div>
          </div>
          
          <div className="mt-6 flex gap-4">
            <Button onClick={submit} disabled={loading}>
              {loading ? "保存中..." : "保存收入记录"}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={addBonus} 
              disabled={loading || !bonus || !bonusDate}
            >
              {loading ? "添加中..." : "添加奖金计划"}
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
                      <td className="py-2">¥{r.taxableCumulative.toLocaleString()}</td>
                      <td className="py-2">¥{r.taxThisMonth.toLocaleString()}</td>
                      <td className="py-2">¥{r.taxDueCumulative.toLocaleString()}</td>
                      <td className="py-2">¥{r.net.toLocaleString()}</td>
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