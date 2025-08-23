"use client";

import Link from "next/link";
import { useState } from "react";
import { BonusPlanForm, SalaryChangeForm } from "@/components/income/forms";
import { CurrencySelect } from "@/components/shared/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useUserConfig } from "@/hooks/use-income-data";

/**
 * 重构后的收入表单组件
 * 移除城市选择功能，城市现在通过用户城市历史管理
 */
export default function IncomeForm() {
  const { baseCurrency, updateUserConfig } = useUserConfig();
  const [selectedCurrency, setSelectedCurrency] = useState(baseCurrency);

  const handleBaseCurrencyChange = (currency: string) => {
    updateUserConfig({ baseCurrency: currency });
  };

  return (
    <div className="space-y-6">
      {/* 基本设置 */}
      <Card>
        <CardHeader>
          <CardTitle>基本设置</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>基准货币</Label>
              <CurrencySelect value={baseCurrency} onChange={handleBaseCurrencyChange} />
            </div>

            <div className="space-y-2">
              <Label>操作币种</Label>
              <CurrencySelect value={selectedCurrency} onChange={setSelectedCurrency} />
            </div>
          </div>

          {/* 城市管理提示 */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="text-blue-600 text-sm">
              💡 <strong>城市管理：</strong>工作城市影响社保公积金计算。如需更改工作城市，请前往{" "}
              <Link href="/settings/city" className="underline font-medium">
                城市管理
              </Link>{" "}
              页面进行设置。
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 工资变化和奖金收入表单 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SalaryChangeForm currency={selectedCurrency} onCurrencyChange={setSelectedCurrency} />
        <BonusPlanForm currency={selectedCurrency} onCurrencyChange={setSelectedCurrency} />
      </div>
    </div>
  );
}
