"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import AccountGridNew from "@/components/investment/account-grid-new";
import AccountOverviewNew from "@/components/investment/account-overview-new";
import PerformanceChart from "@/components/investment/performance-chart";
import { Button } from "@/components/ui/button";
import type { Account } from "@/types";

export default function InvestmentPage() {
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
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">投资管理</h1>
            <p className="page-subtitle">个人资产账户管理系统</p>
          </div>
        </div>
        <div className="text-center py-8">
          <div className="text-muted">请先登录以使用投资管理功能</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" data-testid="investment-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">投资管理</h1>
          <p className="page-subtitle">个人资产账户管理系统</p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline" size="sm" className="back-button">
            <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
            返回仪表板
          </Button>
        </Link>
      </div>

      {/* 账户总览 */}
      <AccountOverviewNew />

      {/* 账户网格 - 包含添加账户卡片 */}
      <div>
        <h2 className="section-title">我的账户</h2>
        <AccountGridNew accounts={accounts} loading={loading} onRefresh={fetchAccounts} />
      </div>

      {/* 账户绩效分析 */}
      {accounts.length > 0 && (
        <div>
          <h2 className="section-title">绩效分析</h2>
          <PerformanceChart />
        </div>
      )}
    </div>
  );
}
