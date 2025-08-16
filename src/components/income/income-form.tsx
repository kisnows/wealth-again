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
  
  // 共同状态
  const [city, setCity] = useState("Hangzhou");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // 工资变化表单状态
  const [salaryGross, setSalaryGross] = useState(20000);
  const [salaryEffectiveDate, setSalaryEffectiveDate] = useState<string>(new Date().toISOString().slice(0,10));
  
  // 奖金收入表单状态
  const [bonusAmount, setBonusAmount] = useState(0);
  const [bonusEffectiveDate, setBonusEffectiveDate] = useState<string>(new Date().toISOString().slice(0,10));

  async function submitSalaryChange() {
    if (!session) return;
    
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/income/changes", {
        method: "POST",
        body: JSON.stringify({ 
          city, 
          grossMonthly: salaryGross,
          effectiveFrom: salaryEffectiveDate
        }),
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error || "保存工资变更失败");
        return;
      }

      setSuccess("工资变更记录保存成功");
      setSalaryGross(20000); // 重置表单

      // 通知其他组件刷新
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("income:refresh"));
      }

    } catch (error) {
      console.error("Error saving salary change:", error);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function submitBonusPlan() {
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
          amount: bonusAmount, 
          effectiveDate: bonusEffectiveDate 
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error?.message || "添加奖金计划失败");
        return;
      }

      setSuccess("奖金计划添加成功");
      setBonusAmount(0); // 重置奖金输入

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
      {/* 全局消息提示 */}
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

      {/* 全局城市设置 */}
      <Card>
        <CardHeader>
          <CardTitle>基本设置</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="city">城市</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="请输入城市"
              className="max-w-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* 工资变化表单 */}
      <Card>
        <CardHeader>
          <CardTitle>工资变化</CardTitle>
          <p className="text-sm text-gray-600">记录月薪变化，用于收入预测计算</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="salaryGross">月薪 (元)</Label>
              <Input
                id="salaryGross"
                type="number"
                value={salaryGross}
                onChange={(e) => setSalaryGross(Number(e.target.value))}
                placeholder="请输入月薪"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="salaryEffectiveDate">生效日期</Label>
              <Input 
                id="salaryEffectiveDate" 
                type="date" 
                value={salaryEffectiveDate} 
                onChange={(e)=> setSalaryEffectiveDate(e.target.value)} 
              />
            </div>
          </div>
          
          <div className="mt-6">
            <Button 
              onClick={submitSalaryChange} 
              disabled={loading || !salaryGross}
            >
              {loading ? "保存中..." : "保存工资变更"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 奖金收入表单 */}
      <Card>
        <CardHeader>
          <CardTitle>奖金收入</CardTitle>
          <p className="text-sm text-gray-600">添加奖金计划，系统将在预测中自动计算相关税费</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bonusAmount">奖金金额 (元)</Label>
              <Input
                id="bonusAmount"
                type="number"
                value={bonusAmount}
                onChange={(e) => setBonusAmount(Number(e.target.value))}
                placeholder="请输入奖金金额"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bonusEffectiveDate">发放日期</Label>
              <Input 
                id="bonusEffectiveDate" 
                type="date" 
                value={bonusEffectiveDate} 
                onChange={(e)=> setBonusEffectiveDate(e.target.value)} 
              />
            </div>
          </div>
          
          <div className="mt-6">
            <Button 
              onClick={submitBonusPlan} 
              disabled={loading || !bonusAmount}
            >
              {loading ? "添加中..." : "添加奖金计划"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}