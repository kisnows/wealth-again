"use client";

import React from "react";
import { IncomeCalculatorForm } from "@/components/tax/income-calculator-form";
import { SpecialDeductionGuide } from "@/components/tax/special-deduction-guide";

export default function TaxCalculatorPage() {
  // 在实际应用中，这里应该从认证系统获取用户ID
  const mockUserId = "user-123";

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          个人所得税及社保计算器
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <IncomeCalculatorForm
              userId={mockUserId}
              defaultCity="Hangzhou"
              onCalculate={(result) => {
                console.log("计算结果:", result);
              }}
            />
          </div>

          <div className="lg:col-span-1">
            <SpecialDeductionGuide />
          </div>
        </div>
      </div>
    </div>
  );
}
