"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SpecialDeductionInput } from "./special-deduction-guide";
import {
  IncomeCalculationInput,
  IncomeCalculationResult,
} from "@/lib/tax/types";

interface IncomeCalculatorFormProps {
  userId: string;
  defaultCity?: string;
  onCalculate?: (result: IncomeCalculationResult) => void;
  className?: string;
}

export function IncomeCalculatorForm({
  userId,
  defaultCity = "Hangzhou",
  onCalculate,
  className,
}: IncomeCalculatorFormProps) {
  const [formData, setFormData] = useState<Partial<IncomeCalculationInput>>({
    userId,
    city: defaultCity,
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    gross: 0,
    bonus: 0,
    specialDeductions: 0,
    otherDeductions: 0,
    charityDonations: 0,
  });

  const [result, setResult] = useState<IncomeCalculationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (
    field: keyof IncomeCalculationInput,
    value: any
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/income/calculate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "计算失败");
      }

      setResult(data.data);
      onCalculate?.(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "计算过程中发生错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">个税及社保计算器</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="city">工作城市</Label>
              <Input
                id="city"
                value={formData.city || ""}
                onChange={(e) => handleInputChange("city", e.target.value)}
                placeholder="如：Hangzhou"
                required
              />
            </div>

            <div>
              <Label htmlFor="year">年份</Label>
              <Input
                id="year"
                type="number"
                value={formData.year || ""}
                onChange={(e) =>
                  handleInputChange("year", parseInt(e.target.value))
                }
                min="2020"
                max="2030"
                required
              />
            </div>

            <div>
              <Label htmlFor="month">月份</Label>
              <Input
                id="month"
                type="number"
                value={formData.month || ""}
                onChange={(e) =>
                  handleInputChange("month", parseInt(e.target.value))
                }
                min="1"
                max="12"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="gross">月度税前收入（元）</Label>
              <Input
                id="gross"
                type="number"
                value={formData.gross || ""}
                onChange={(e) =>
                  handleInputChange("gross", parseFloat(e.target.value) || 0)
                }
                min="0"
                step="0.01"
                placeholder="请输入税前工资"
                required
              />
            </div>

            <div>
              <Label htmlFor="bonus">当月奖金（元）</Label>
              <Input
                id="bonus"
                type="number"
                value={formData.bonus || ""}
                onChange={(e) =>
                  handleInputChange("bonus", parseFloat(e.target.value) || 0)
                }
                min="0"
                step="0.01"
                placeholder="如季度奖、年终奖分摊等"
              />
            </div>
          </div>

          <SpecialDeductionInput
            value={formData.specialDeductions || 0}
            onChange={(value) => handleInputChange("specialDeductions", value)}
            showGuide={false}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="otherDeductions">其他扣除（元/月）</Label>
              <Input
                id="otherDeductions"
                type="number"
                value={formData.otherDeductions || ""}
                onChange={(e) =>
                  handleInputChange(
                    "otherDeductions",
                    parseFloat(e.target.value) || 0
                  )
                }
                min="0"
                step="0.01"
                placeholder="如年金、补充医疗等"
              />
            </div>

            <div>
              <Label htmlFor="charityDonations">公益慈善捐赠（元/月）</Label>
              <Input
                id="charityDonations"
                type="number"
                value={formData.charityDonations || ""}
                onChange={(e) =>
                  handleInputChange(
                    "charityDonations",
                    parseFloat(e.target.value) || 0
                  )
                }
                min="0"
                step="0.01"
                placeholder="符合条件的公益捐赠"
              />
            </div>
          </div>

          <div className="pt-4">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "计算中..." : "计算个税及社保"}
            </Button>
          </div>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">
            {error}
          </div>
        )}
      </Card>

      {result && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">计算结果</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-3 bg-blue-50 rounded">
              <div className="text-sm text-gray-600">税前总收入</div>
              <div className="text-xl font-semibold text-blue-600">
                ¥{(result.grossIncome + result.bonus).toLocaleString()}
              </div>
            </div>

            <div className="p-3 bg-yellow-50 rounded">
              <div className="text-sm text-gray-600">社保公积金</div>
              <div className="text-xl font-semibold text-yellow-600">
                ¥
                {(result.socialInsurance + result.housingFund).toLocaleString()}
              </div>
            </div>

            <div className="p-3 bg-red-50 rounded">
              <div className="text-sm text-gray-600">个人所得税</div>
              <div className="text-xl font-semibold text-red-600">
                ¥{result.incomeTax.toLocaleString()}
              </div>
            </div>

            <div className="p-3 bg-green-50 rounded">
              <div className="text-sm text-gray-600">税后实发</div>
              <div className="text-xl font-semibold text-green-600">
                ¥{result.netIncome.toLocaleString()}
              </div>
            </div>

            <div className="p-3 bg-purple-50 rounded">
              <div className="text-sm text-gray-600">实际税率</div>
              <div className="text-xl font-semibold text-purple-600">
                {result.effectiveTaxRate.toFixed(2)}%
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded">
              <div className="text-sm text-gray-600">应纳税所得额</div>
              <div className="text-xl font-semibold text-gray-600">
                ¥{result.taxableIncome.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            <div>
              社保缴费基数：¥{result.socialInsuranceBase.toLocaleString()}
            </div>
            <div>
              公积金缴费基数：¥{result.housingFundBase.toLocaleString()}
            </div>
            <div>适用税率：{result.appliedTaxBracket.rate}%</div>
            <div>
              速算扣除数：¥
              {result.appliedTaxBracket.quickDeduction.toLocaleString()}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
