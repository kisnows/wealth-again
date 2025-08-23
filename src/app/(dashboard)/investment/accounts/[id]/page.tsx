"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from "recharts";
import ValuationSnapshots from "@/components/investment/valuation-snapshots";

interface AccountDetail {
  account: {
    id: string;
    name: string;
    baseCurrency: string;
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
  snapshots: {
    id: string;
    asOf: string;
    totalValue: number;
  }[];
}

export default function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session } = useSession();
  const [accountDetail, setAccountDetail] = useState<AccountDetail | null>(null);
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
    }
  }, [session, accountId]);

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
      </div>
    );
  }

  if (!accountDetail) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center py-8">账户不存在</div>
      </div>
    );
  }

  const { account, performance, twr, snapshots } = accountDetail;
  
  // 准备图表数据
  const chartData = snapshots.map(snapshot => ({
    date: new Date(snapshot.asOf).toLocaleDateString(),
    value: snapshot.totalValue,
    principal: performance.actualPrincipal
  })).reverse(); // 反转以按时间顺序显示

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{account.name}</h1>
        <Button onClick={fetchAccountDetail} variant="outline">刷新</Button>
      </div>

      {/* 账户基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle>账户信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">账户名称</p>
              <p className="font-medium">{account.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">基础货币</p>
              <p className="font-medium">{account.baseCurrency}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">初始资金</p>
              <p className="font-medium">{formatCurrency(account.initialBalance)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">创建时间</p>
              <p className="font-medium">{new Date(account.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 投资绩效概览 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">当前估值</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(performance.currentValue)}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">实际本金</p>
            <p className="text-2xl font-bold">
              {formatCurrency(performance.actualPrincipal)}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">投资收益</p>
            <p className={`text-2xl font-bold ${performance.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(performance.profit)}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">收益率</p>
            <p className={`text-2xl font-bold ${performance.rateOfReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {performance.rateOfReturn.toFixed(2)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 时间加权收益率 */}
      <Card>
        <CardHeader>
          <CardTitle>时间加权收益率 (TWR)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-3xl font-bold text-blue-600">
              {twr.twr.toFixed(2)}%
            </div>
            <div className="text-sm text-gray-600">
              基于 {twr.periods} 个期间计算
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            时间加权收益率消除了资金流入流出对投资回报的影响，更准确地反映了投资决策的表现。
          </p>
        </CardContent>
      </Card>

      {/* 交易统计 */}
      <Card>
        <CardHeader>
          <CardTitle>交易统计</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">累计存款</p>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(account.totalDeposits)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">累计取款</p>
              <p className="text-xl font-bold text-red-600">
                {formatCurrency(account.totalWithdrawals)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">交易记录</p>
              <p className="text-xl font-bold">
                {performance.transactionCount} 笔
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 估值趋势图 */}
      <Card>
        <CardHeader>
          <CardTitle>账户价值趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  formatter={(value) => [formatCurrency(Number(value)), '金额']}
                  labelFormatter={(label) => `日期: ${label}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  name="账户价值" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="principal" 
                  name="实际本金" 
                  stroke="#82ca9d" 
                  strokeDasharray="5 5"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 估值快照记录 */}
      <ValuationSnapshots accountId={accountId} />
    </div>
  );
}