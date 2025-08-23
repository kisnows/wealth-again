"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { Account } from "@/types";

interface AccountSummary {
  totalAccounts: number;
  totalAssets: number;
  totalLiabilities: number;
  netAssets: number;
  savingsTotal: number;
  investmentTotal: number;
  loanTotal: number;
  totalGainLoss: number;
  totalGainLossRate: number;
}

export default function AccountOverviewNew() {
  const { data: session } = useSession();
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (session) {
      fetchAccountSummary();
    }
  }, [session]);

  async function fetchAccountSummary() {
    try {
      setLoading(true);
      const response = await fetch("/api/accounts/summary");
      const data = await response.json();

      if (data.success) {
        setSummary(data.data);
      } else {
        setError(data.error?.message || "获取账户概览失败");
      }
    } catch (error) {
      console.error("Error fetching account summary:", error);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">加载账户概览中...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-500">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-gray-500">暂无账户数据</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">账户总览</h2>
        <div className="text-sm text-gray-600">共 {summary.totalAccounts} 个账户</div>
      </div>

      {/* 净资产概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-600">净资产</p>
                <p className="text-2xl font-bold text-green-700">
                  {formatCurrency(summary.netAssets)}
                </p>
              </div>
              <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center">
                <span className="text-green-700 text-lg">💰</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-600">总资产</p>
                <p className="text-2xl font-bold">{formatCurrency(summary.totalAssets)}</p>
              </div>
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-700 text-lg">📈</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-600">总负债</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(summary.totalLiabilities)}
                </p>
              </div>
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-red-700 text-lg">📉</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-600">总收益</p>
                <p
                  className={`text-2xl font-bold ${summary.totalGainLoss >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {formatCurrency(summary.totalGainLoss)}
                </p>
                <p
                  className={`text-sm ${summary.totalGainLossRate >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  ({summary.totalGainLossRate.toFixed(2)}%)
                </p>
              </div>
              <div
                className={`w-8 h-8 ${summary.totalGainLoss >= 0 ? "bg-green-100" : "bg-red-100"} rounded-full flex items-center justify-center`}
              >
                <span
                  className={`${summary.totalGainLoss >= 0 ? "text-green-700" : "text-red-700"} text-lg`}
                >
                  {summary.totalGainLoss >= 0 ? "📊" : "📋"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 账户类型分布 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">储蓄账户</p>
              <p className="text-xl font-bold text-blue-700">
                {formatCurrency(summary.savingsTotal)}
              </p>
              <p className="text-sm text-blue-600 mt-1">流动资金</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">投资账户</p>
              <p className="text-xl font-bold text-purple-700">
                {formatCurrency(summary.investmentTotal)}
              </p>
              <p className="text-sm text-purple-600 mt-1">长期资金</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">借贷账户</p>
              <p className="text-xl font-bold text-orange-700">
                {formatCurrency(summary.loanTotal)}
              </p>
              <p className="text-sm text-orange-600 mt-1">负债资金</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
