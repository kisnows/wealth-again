"use client";

import { useEffect, useState } from "react";
import { CurrencyDisplay, PercentageDisplay } from "@/components/shared/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/dashboard");
        const data = await response.json();

        if (response.ok) {
          setDashboardData(data);
        } else {
          setError(data.error || "获取数据失败");
        }
      } catch (err) {
        setError("网络错误");
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6">财务概览</h1>
        <div className="text-center py-8">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6">财务概览</h1>
        <div className="text-center py-8 text-red-500">错误: {error}</div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6">财务概览</h1>
        <div className="text-center py-8">暂无数据</div>
      </div>
    );
  }

  const { income, investment, financialHealth } = dashboardData;

  // 安全地处理数值，防止NaN或Infinity
  const safeValue = (value: any) => {
    const num = Number(value);
    return isNaN(num) || !isFinite(num) ? 0 : num;
  };

  // 格式化百分比值
  const formatPercent = (value: any) => {
    const num = safeValue(value);
    return `${num.toFixed(2)}%`;
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">财务概览</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>收入概览</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>本月税前收入</span>
                <CurrencyDisplay
                  amount={safeValue(income.monthlyIncome)}
                  className="font-semibold"
                  data-testid="monthly-income"
                />
              </div>
              <div className="flex justify-between">
                <span>年度税前收入</span>
                <CurrencyDisplay
                  amount={safeValue(income.annualIncome)}
                  className="font-semibold"
                  data-testid="annual-income"
                />
              </div>
              <div className="flex justify-between">
                <span>年度税收</span>
                <CurrencyDisplay
                  amount={safeValue(income.annualTax)}
                  className="font-semibold text-red-500"
                  data-testid="annual-tax"
                />
              </div>
              <div className="flex justify-between">
                <span>年度税后收入</span>
                <CurrencyDisplay
                  amount={safeValue(income.annualNetIncome)}
                  className="font-semibold"
                  data-testid="annual-net-income"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>投资概览</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>总投资价值</span>
                <CurrencyDisplay
                  amount={safeValue(investment.totalValue)}
                  className="font-semibold"
                  data-testid="total-investment-value"
                />
              </div>
              <div className="flex justify-between">
                <span>本月盈亏</span>
                <CurrencyDisplay
                  amount={safeValue(investment.monthlyPnl)}
                  className={`font-semibold ${
                    safeValue(investment.monthlyPnl) >= 0 ? "text-green-500" : "text-red-500"
                  }`}
                  data-testid="monthly-pnl"
                />
              </div>
              <div className="flex justify-between">
                <span>年度收益率</span>
                <PercentageDisplay
                  value={investment.annualReturn}
                  className="font-semibold"
                  data-testid="annual-return"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>财务健康度</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span>储蓄率</span>
                  <span>{safeValue(financialHealth.savingsRate).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full"
                    style={{
                      width: `${Math.min(safeValue(financialHealth.savingsRate), 100)}%`,
                    }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span>投资资产占比</span>
                  <span>{safeValue(financialHealth.investmentRatio).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-green-600 h-2.5 rounded-full"
                    style={{
                      width: `${Math.min(safeValue(financialHealth.investmentRatio), 100)}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
