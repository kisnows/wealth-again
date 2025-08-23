"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrencyWithSeparator } from "@/lib/currency";

interface LongTermCashFormProps {
  onAdd: (data: { city: string; totalAmount: number; effectiveDate: string }) => Promise<void>;
}

export default function LongTermCashForm({ onAdd }: LongTermCashFormProps) {
  const [city, setCity] = useState("Hangzhou");
  const [currency, setCurrency] = useState("CNY");
  const [userBaseCurrency, setUserBaseCurrency] = useState("CNY");
  const [totalAmount, setTotalAmount] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 获取用户配置
  useEffect(() => {
    async function loadConfig() {
      try {
        const userResponse = await fetch("/api/user/profile");
        const userData = await userResponse.json();
        if (userData.success && userData.data?.baseCurrency) {
          setUserBaseCurrency(userData.data.baseCurrency);
          setCurrency(userData.data.baseCurrency);
        }
      } catch (err) {
        console.error("Failed to load user config:", err);
      }
    }
    loadConfig();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const amount = parseFloat(totalAmount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("请输入有效的金额");
      }

      if (!effectiveDate) {
        throw new Error("请选择生效日期");
      }

      await onAdd({ city, totalAmount: amount, effectiveDate, currency });
      
      // Reset form
      setTotalAmount("");
      setEffectiveDate("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg">
      <h3 className="text-lg font-medium">添加长期现金</h3>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="city">城市</Label>
          <Input
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="例如：Hangzhou"
          />
        </div>
        
        <div>
          <Label htmlFor="currency">币种</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger>
              <SelectValue placeholder="选择币种" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CNY">人民币 (¥)</SelectItem>
              <SelectItem value="HKD">港元 (HK$)</SelectItem>
              <SelectItem value="USD">美元 ($)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="totalAmount">总金额 ({currency === "CNY" ? "元" : currency === "HKD" ? "港元" : "美元"})</Label>
          <Input
            id="totalAmount"
            type="number"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            placeholder={`请输入总金额 (${currency})`}
            step="0.01"
          />
        </div>
        
        <div>
          <Label htmlFor="effectiveDate">生效日期</Label>
          <Input
            id="effectiveDate"
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
          />
        </div>
      </div>

      <div className="text-sm text-gray-500">
        <p>说明：长期现金将分4年（16个季度）发放，每年的1、4、7、10月发放一次。</p>
        {totalAmount && !isNaN(parseFloat(totalAmount)) && (
          <p className="mt-1">
            每季度发放金额：{formatCurrencyWithSeparator(parseFloat(totalAmount) / 16)}
          </p>
        )}
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? "添加中..." : "添加长期现金"}
      </Button>
    </form>
  );
}