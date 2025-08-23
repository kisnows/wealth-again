"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import AccountOperationRecords from "@/components/investment/account-operation-records";
import AccountOperationsPanel from "@/components/investment/account-operations-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { Account, Transaction, ValuationSnapshot } from "@/types";

interface AccountDetail {
  account: Account & {
    initialBalance: number;
    totalDeposits: number;
    totalWithdrawals: number;
    createdAt: string;
  };
  performance: {
    accountId: string;
    initialBalance: number;
    netDeposits: number;
    actualPrincipal: number;
    currentValue: number;
    profit: number;
    rateOfReturn: number;
    snapshotCount: number;
    transactionCount: number;
  };
  twr: {
    twr: number;
    periods: number;
  };
  snapshots: ValuationSnapshot[];
  transactions: Transaction[];
}

export default function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [accountDetail, setAccountDetail] = useState<AccountDetail | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string>("");

  useEffect(() => {
    const getAccountId = async () => {
      const resolvedParams = await params;
      setAccountId(resolvedParams.id);
    };

    getAccountId();
  }, [params]);

  useEffect(() => {
    if (session && accountId) {
      fetchAccountDetail();
      fetchAccounts();
    }
  }, [session, accountId]);

  async function fetchAccounts() {
    try {
      const response = await fetch("/api/accounts");
      const data = await response.json();

      if (data.success) {
        setAccounts(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
    }
  }

  async function fetchAccountDetail() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/accounts/${accountId}`);
      const data = await response.json();

      if (data.success) {
        setAccountDetail(data.data);
      } else {
        setError(data.error?.message || "获取账户详情失败");
      }
    } catch (err) {
      console.error("Error fetching account detail:", err);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  const handleArchiveAccount = async () => {
    if (!accountDetail?.account) return;

    const confirmed = confirm(
      `确定要归档账户"${accountDetail.account.name}"吗？归档后账户将不再显示在主列表中，但历史数据会被保留。`,
    );
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ARCHIVED" }),
      });

      const data = await response.json();

      if (data.success) {
        alert("账户已归档");
        router.push("/investment");
      } else {
        alert(data.error?.message || "归档账户失败");
      }
    } catch (error) {
      console.error("Error archiving account:", error);
      alert("网络错误，请稍后重试");
    }
  };

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case "SAVINGS":
        return "储蓄账户";
      case "INVESTMENT":
        return "投资账户";
      case "LOAN":
        return "借贷账户";
      default:
        return type;
    }
  };

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case "SAVINGS":
        return "bg-green-100 text-green-800 border-green-200";
      case "INVESTMENT":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "LOAN":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center py-8">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center py-8 text-red-500">错误: {error}</div>
        <div className="text-center">
          <Button onClick={() => router.push("/investment")}>返回投资管理</Button>
        </div>
      </div>
    );
  }

  if (!accountDetail) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center py-8">账户不存在</div>
        <div className="text-center">
          <Button onClick={() => router.push("/investment")}>返回投资管理</Button>
        </div>
      </div>
    );
  }

  const { account, performance, twr } = accountDetail;

  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="account-detail-page">
      {/* 账户标题和操作栏 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/investment")}
            data-testid="back-to-investment-button"
          >
            ← 返回
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{account.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`px-2 py-1 rounded text-sm font-medium border ${getAccountTypeColor(account.accountType)}`}
              >
                {getAccountTypeLabel(account.accountType)}
              </span>
              {account.subType && (
                <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
                  {account.subType}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchAccountDetail} variant="outline" data-testid="refresh-button">
            刷新
          </Button>
          <Button onClick={handleArchiveAccount} variant="outline" data-testid="archive-button">
            归档账户
          </Button>
        </div>
      </div>

      {/* 账户核心数据 - 本金、市值、收益 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">实际本金</p>
              <p className="text-2xl font-bold text-blue-700">
                {formatCurrency(performance.actualPrincipal)}
              </p>
              <p className="text-xs text-blue-600 mt-1">投入资本</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">当前市值</p>
              <p className="text-2xl font-bold text-green-700">
                {formatCurrency(performance.currentValue)}
              </p>
              <p className="text-xs text-green-600 mt-1">最新估值</p>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`bg-gradient-to-br ${performance.profit >= 0 ? "from-emerald-50 to-emerald-100" : "from-red-50 to-red-100"}`}
        >
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">投资收益</p>
              <p
                className={`text-2xl font-bold ${performance.profit >= 0 ? "text-emerald-700" : "text-red-700"}`}
              >
                {formatCurrency(performance.profit)}
              </p>
              <p
                className={`text-xs mt-1 ${performance.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}
              >
                {performance.profit >= 0 ? "盈利" : "亏损"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`bg-gradient-to-br ${performance.rateOfReturn >= 0 ? "from-purple-50 to-purple-100" : "from-orange-50 to-orange-100"}`}
        >
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">收益率</p>
              <p
                className={`text-2xl font-bold ${performance.rateOfReturn >= 0 ? "text-purple-700" : "text-orange-700"}`}
              >
                {performance.rateOfReturn.toFixed(2)}%
              </p>
              <p
                className={`text-xs mt-1 ${performance.rateOfReturn >= 0 ? "text-purple-600" : "text-orange-600"}`}
              >
                绝对收益率
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 账户基础信息和TWR */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>账户信息</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">账户名称</span>
                <span className="font-medium">{account.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">基础货币</span>
                <span className="font-medium">{account.baseCurrency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">初始资金</span>
                <span className="font-medium">{formatCurrency(account.initialBalance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">累计存款</span>
                <span className="text-green-600 font-medium">
                  +{formatCurrency(account.totalDeposits)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">累计取款</span>
                <span className="text-red-600 font-medium">
                  -{formatCurrency(account.totalWithdrawals)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">创建时间</span>
                <span className="font-medium">
                  {new Date(account.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
            {account.description && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-600 mb-1">账户描述</p>
                <p className="text-sm">{account.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>时间加权收益率 (TWR)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-4">
              <div
                className={`text-4xl font-bold mb-2 ${twr.twr >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                {twr.twr.toFixed(2)}%
              </div>
              <div className="text-sm text-gray-600">基于 {twr.periods} 个期间计算</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded p-4">
              <p className="text-sm text-blue-700">
                💡 时间加权收益率消除了资金流入流出对投资回报的影响，更准确地反映了投资决策的表现。
              </p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-600">交易记录</p>
                <p className="text-lg font-semibold">{performance.transactionCount} 笔</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">估值快照</p>
                <p className="text-lg font-semibold">{performance.snapshotCount} 个</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 账户操作功能区 */}
      <AccountOperationsPanel
        accountId={accountId}
        account={account}
        accounts={accounts}
        onOperationComplete={fetchAccountDetail}
      />

      {/* 账户操作记录 */}
      <div>
        <h2 className="text-xl font-semibold mb-4">账户记录</h2>
        <AccountOperationRecords accountId={accountId} />
      </div>
    </div>
  );
}
