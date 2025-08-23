"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import AccountGridNew from "@/components/investment/account-grid-new";
import AccountOverviewNew from "@/components/investment/account-overview-new";
import PerformanceChart from "@/components/investment/performance-chart";
import type { Account } from "@/types";

export default function InvestmentPageNew() {
  const { data: session } = useSession();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = async () => {
    if (!session) return;

    try {
      const response = await fetch("/api/accounts");
      const data = await response.json();

      if (data.success) {
        setAccounts(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [session]);

  if (!session) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <p className="text-gray-500">请先登录以使用投资管理功能</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8" data-testid="investment-page-new">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">投资管理</h1>
        <div className="text-sm text-gray-500">个人资产账户管理系统</div>
      </div>

      {/* 账户总览 */}
      <AccountOverviewNew />

      {/* 账户网格 - 包含添加账户卡片 */}
      <div>
        <h2 className="text-xl font-semibold mb-4">我的账户</h2>
        <AccountGridNew accounts={accounts} loading={loading} onRefresh={fetchAccounts} />
      </div>

      {/* 账户绩效分析 */}
      {accounts.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">绩效分析</h2>
          <PerformanceChart />
        </div>
      )}
    </div>
  );
}
