"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { CurrencySelect } from "@/components/ui/currency-display";
import { SalaryChangeForm, BonusPlanForm } from "@/components/income/forms";
import { MessagesContainer } from "@/components/ui/messages";
import { useUserConfig } from "@/hooks/use-income-data";

/**
 * 重构后的收入表单组件
 * 只负责表单组合和基本设置
 */
export default function IncomeForm() {
  const { baseCurrency, cities, updateUserConfig } = useUserConfig();
  const [selectedCity, setSelectedCity] = useState("Hangzhou");
  const [selectedCurrency, setSelectedCurrency] = useState(baseCurrency);

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
              <Label htmlFor="city">城市</Label>
              <select
                id="city"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="border rounded px-3 py-2 w-full"
              >
                {cities.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="currency">币种</Label>
              <CurrencySelect 
                value={selectedCurrency} 
                onChange={setSelectedCurrency}
                className="w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 工资变化和奖金收入表单 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SalaryChangeForm
          city={selectedCity}
          currency={selectedCurrency}
          onCurrencyChange={setSelectedCurrency}
        />
        <BonusPlanForm
          city={selectedCity}
          currency={selectedCurrency}
          onCurrencyChange={setSelectedCurrency}
        />
      </div>
    </div>
  );
}