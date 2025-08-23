"use client";

import { useState } from "react";
import { CurrencySelect } from "@/components/shared/currency";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormSubmit } from "@/hooks/use-income-data";

interface SalaryChangeFormProps {
  currency: string;
  onCurrencyChange: (currency: string) => void;
}

/**
 * 工资变更表单组件 - 记录薪资变化，与城市无关
 */
export function SalaryChangeForm({ currency, onCurrencyChange }: SalaryChangeFormProps) {
  const [salary, setSalary] = useState(20000);
  const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const { submit, loading, error, success } = useFormSubmit("/api/income/changes", {
    successMessage: "工资变更记录保存成功",
    onSuccess: () => {
      setSalary(20000);
    },
  });

  const handleSubmit = () => {
    submit({
      grossMonthly: salary,
      effectiveFrom: effectiveDate,
      currency,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>工资变化</CardTitle>
        <p className="text-sm text-gray-600">记录月薪变化，用于收入预测计算</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="salary">月薪</Label>
              <Input
                id="salary"
                type="number"
                value={salary}
                onChange={(e) => setSalary(Number(e.target.value))}
                placeholder="请输入月薪"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="salary-date">生效日期</Label>
              <Input
                id="salary-date"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>币种</Label>
            <CurrencySelect value={currency} onChange={onCurrencyChange} />
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}

          {success && <div className="text-green-600 text-sm">{success}</div>}

          <Button onClick={handleSubmit} disabled={loading || !salary} className="w-full">
            {loading ? "保存中..." : "保存工资变更"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface BonusPlanFormProps {
  currency: string;
  onCurrencyChange: (currency: string) => void;
}

/**
 * 奖金计划表单组件 - 记录奖金发放计划，与城市无关
 */
export function BonusPlanForm({ currency, onCurrencyChange }: BonusPlanFormProps) {
  const [amount, setAmount] = useState(0);
  const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const { submit, loading, error, success } = useFormSubmit("/api/income/bonus", {
    successMessage: "奖金计划添加成功",
    onSuccess: () => {
      setAmount(0);
    },
  });

  const handleSubmit = () => {
    submit({
      amount,
      effectiveDate,
      currency,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>奖金收入</CardTitle>
        <p className="text-sm text-gray-600">添加奖金计划，系统将在预测中自动计算相关税费</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bonus-amount">奖金金额</Label>
              <Input
                id="bonus-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                placeholder="请输入奖金金额"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bonus-date">发放日期</Label>
              <Input
                id="bonus-date"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>币种</Label>
            <CurrencySelect value={currency} onChange={onCurrencyChange} />
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}

          {success && <div className="text-green-600 text-sm">{success}</div>}

          <Button onClick={handleSubmit} disabled={loading || !amount} className="w-full">
            {loading ? "添加中..." : "添加奖金计划"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
