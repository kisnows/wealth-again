"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

type Transaction = {
  id: string;
  type: string;
  tradeDate: string;
  amount: string;
  currency: string;
  note?: string;
};

type Snapshot = {
  id: string;
  asOf: string;
  totalValue: string;
};

type PerformanceData = {
  date: string;
  value: number;
  cumulativeNetContribution: number;
  twrCumulative: number;
  dailyReturn?: number;
};

export default function AccountOverview({ accountId, baseCurrency }: { accountId: string; baseCurrency: string }) {
  // 状态管理
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // 表单状态
  const [cashDate, setCashDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [cashType, setCashType] = useState<"DEPOSIT" | "WITHDRAW">("DEPOSIT");
  const [snapDate, setSnapDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [snapValue, setSnapValue] = useState<number>(0);
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferTo, setTransferTo] = useState<string>("");
  
  // 数据状态
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [accounts, setAccounts] = useState<{id:string; name:string}[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [transactionFilter, setTransactionFilter] = useState<string>("ALL");
  
  // 账户概览数据
  const [overview, setOverview] = useState({
    initialValue: 0,      // 初始资金
    totalValue: 0,        // 账户市值（当前估值）
    totalContribution: 0, // 本金（实际本金）
    totalPnL: 0,          // 总收益
    totalReturn: 0        // 总收益率
  });

  // 加载所有数据
  async function loadAllData() {
    setLoading(true);
    setError("");
    
    try {
      const [transactionsRes, snapshotsRes, accountsRes, performanceRes] = await Promise.all([
        fetch(`/api/transactions?accountId=${accountId}&pageSize=100`),
        fetch(`/api/accounts/${accountId}/snapshots?pageSize=100`),
        fetch("/api/accounts"),
        fetch(`/api/accounts/${accountId}/performance`)
      ]);

      const [transactionsData, snapshotsData, accountsData, performanceData] = await Promise.all([
        transactionsRes.json(),
        snapshotsRes.json(),
        accountsRes.json(),
        performanceRes.json()
      ]);

      // 设置交易数据
      const txs = transactionsData.data || [];
      
      // 设置快照数据
      const snaps = snapshotsData.snapshots || [];
      setSnapshots(snaps);
      
      // 合并交易记录和快照记录，创建统一的变更记录
      const allChanges = [
        ...txs.map(tx => ({
          id: tx.id,
          date: tx.tradeDate,
          type: tx.type,
          amount: tx.amount,
          currency: tx.currency,
          note: tx.note,
          isTransaction: true
        })),
        ...snaps.map(snap => ({
          id: snap.id,
          date: snap.asOf,
          type: "VALUATION",
          amount: snap.totalValue,
          currency: baseCurrency,
          note: null,
          isSnapshot: true
        }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // 按日期倒序排列
      
      setTransactions(allChanges);
      setFilteredTransactions(allChanges);
      
      // 设置账户数据
      setAccounts((accountsData.data || []).filter((a: any) => a.id !== accountId).map((a: any) => ({id: a.id, name: a.name})));
      
      // 设置性能数据并计算每日收益率
      const perfSeries = performanceData.series || [];
      const perfDataWithReturns = perfSeries.map((point: any, index: number) => {
        let dailyReturn = 0;
        if (index > 0) {
          const prevPoint = perfSeries[index - 1];
          const valueChange = point.value - prevPoint.value;
          const contribution = point.netContribution; // 使用固定的净入金
          const baseValue = contribution;
          dailyReturn = baseValue !== 0 ? (valueChange / baseValue) * 100 : 0;
        }
        return {
          ...point,
          date: new Date(point.date).toLocaleDateString(),
          dailyReturn
        };
      });
      setPerformanceData(perfDataWithReturns);
      
      // 计算账户概览数据
      if (performanceData.performance) {
        const perf = performanceData.performance;
        setOverview({
          initialValue: perf.initialValue || 0,
          totalValue: perf.currentValue || 0,
          totalContribution: perf.netContribution || 0,
          totalPnL: perf.pnl || 0,
          totalReturn: perf.returnRate || 0
        });
      }
    } catch (error) {
      console.error("Error loading data:", error);
      setError("加载数据失败");
    } finally {
      setLoading(false);
    }
  }

  // 筛选交易
  useEffect(() => {
    if (transactionFilter === "ALL") {
      setFilteredTransactions(transactions);
    } else if (transactionFilter === "VALUATION") {
      setFilteredTransactions(transactions.filter(tx => tx.isSnapshot));
    } else {
      setFilteredTransactions(transactions.filter(tx => tx.type === transactionFilter));
    }
  }, [transactionFilter, transactions]);

  // 初始化加载数据
  useEffect(() => {
    loadAllData();
  }, [accountId]);

  // 添加现金流（注资/提款）
  async function addCashflow() {
    if (cashAmount <= 0) {
      setError("请输入有效的金额");
      return;
    }
    
    setLoading(true);
    setError("");
    setSuccess("");
    
    try {
      const res = await fetch(`/api/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          type: cashType,
          tradeDate: cashDate,
          cashAmount: cashAmount,
          currency: baseCurrency,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setSuccess("操作成功");
        setCashAmount(0);
        
        // 自动更新账户市值
        await updateAccountValueAutomatically(cashType, cashAmount);
        await loadAllData();
      } else {
        setError(data.error?.message || "操作失败");
      }
    } catch (error) {
      console.error("Error adding cashflow:", error);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  // 添加估值快照
  async function addSnapshot() {
    if (snapValue < 0) {
      setError("请输入有效的金额");
      return;
    }
    
    setLoading(true);
    setError("");
    setSuccess("");
    
    try {
      const res = await fetch(`/api/valuations/snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          accountId, 
          asOf: snapDate, 
          totalValue: snapValue 
        }),
      });
      
      const data = await res.json();
      
      if (data.id) {
        setSuccess("快照保存成功");
        setSnapValue(0);
        await loadAllData();
      } else {
        setError("保存快照失败");
      }
    } catch (error) {
      console.error("Error adding snapshot:", error);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  // 转账
  async function transfer() {
    if (!transferTo || transferAmount <= 0) {
      setError("请选择目标账户并输入有效金额");
      return;
    }
    
    setLoading(true);
    setError("");
    setSuccess("");
    
    try {
      const res = await fetch(`/api/transactions/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAccountId: accountId,
          toAccountId: transferTo,
          amount: transferAmount,
          date: new Date().toISOString().slice(0, 10),
          currency: baseCurrency,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setSuccess("转账成功");
        setTransferAmount(0);
        setTransferTo("");
        
        // 自动更新当前账户市值（转出）
        await updateAccountValueAutomatically("TRANSFER_OUT", transferAmount);
        await loadAllData();
      } else {
        setError(data.error?.message || "转账失败");
      }
    } catch (error) {
      console.error("Error transferring:", error);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  // 自动更新账户市值
  async function updateAccountValueAutomatically(transactionType: string, amount: number) {
    try {
      // 获取最新的账户市值
      const latestSnapshot = await fetch(`/api/accounts/${accountId}/snapshots?pageSize=1`);
      const snapshotData = await latestSnapshot.json();
      const latestValue = snapshotData.snapshots && snapshotData.snapshots.length > 0 
        ? Number(snapshotData.snapshots[0].totalValue || 0)
        : 0;
      
      // 根据交易类型计算新的市值
      let newValue = latestValue;
      if (transactionType === "DEPOSIT" || transactionType === "TRANSFER_IN") {
        newValue = latestValue + amount;
      } else if (transactionType === "WITHDRAW" || transactionType === "TRANSFER_OUT") {
        newValue = latestValue - amount;
      }
      
      // 创建新的快照记录
      if (newValue >= 0) {
        await fetch(`/api/valuations/snapshot`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId,
            asOf: new Date().toISOString().split('T')[0], // 使用当前日期
            totalValue: newValue
          }),
        });
      }
    } catch (error) {
      console.error("Error updating account value automatically:", error);
      // 不中断主流程，即使自动更新失败也继续
    }
  }

  // 自动更新账户市值
  async function updateAccountValueAutomatically(transactionType: string, amount: number) {
    try {
      // 获取最新的账户市值
      const latestSnapshot = await fetch(`/api/accounts/${accountId}/snapshots?pageSize=1`);
      const snapshotData = await latestSnapshot.json();
      const latestValue = snapshotData.snapshots && snapshotData.snapshots.length > 0 
        ? Number(snapshotData.snapshots[0].totalValue || 0)
        : 0;
      
      // 根据交易类型计算新的市值
      let newValue = latestValue;
      if (transactionType === "DEPOSIT" || transactionType === "TRANSFER_IN") {
        newValue = latestValue + amount;
      } else if (transactionType === "WITHDRAW" || transactionType === "TRANSFER_OUT") {
        newValue = latestValue - amount;
      }
      
      // 创建新的快照记录
      if (newValue >= 0) {
        await fetch(`/api/valuations/snapshot`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId,
            asOf: new Date().toISOString().split('T')[0], // 使用当前日期
            totalValue: newValue
          }),
        });
      }
    } catch (error) {
      console.error("Error updating account value automatically:", error);
      // 不中断主流程，即使自动更新失败也继续
    }
  }

  // 删除交易
  async function deleteTransaction(id: string) {
    if (!confirm("确定要删除这条记录吗？")) return;
    
    setLoading(true);
    setError("");
    setSuccess("");
    
    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: "DELETE",
      });
      
      const data = await res.json();
      
      if (data.success) {
        setSuccess("删除成功");
        await loadAllData();
      } else {
        setError(data.error?.message || "删除失败");
      }
    } catch (error) {
      console.error("Error deleting transaction:", error);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  // 获取交易类型显示名称
  const getTransactionTypeName = (type: string) => {
    const typeMap: Record<string, string> = {
      "DEPOSIT": "注资",
      "WITHDRAW": "提款",
      "TRANSFER_IN": "转入",
      "TRANSFER_OUT": "转出",
      "VALUATION": "估值快照"
    };
    return typeMap[type] || type;
  };

  return (
    <div className="space-y-6">
      {/* 消息提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {/* 账户概览 */}
      <Card>
        <CardHeader>
          <CardTitle>账户概览</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-500">本金</div>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(overview.totalContribution, baseCurrency)}
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-500">账户市值</div>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(overview.totalValue, baseCurrency)}
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-500">总收益</div>
              <div className={`text-2xl font-bold ${overview.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(overview.totalPnL, baseCurrency)}
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-500">总收益率</div>
              <div className={`text-2xl font-bold ${overview.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {overview.totalReturn.toFixed(2)}%
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-500">初始资金</div>
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(overview.initialValue, baseCurrency)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 账户价值图表 */}
      {performanceData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>账户价值变动</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value) => formatCurrency(Number(value))}
                    labelFormatter={(label) => `日期: ${label}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#8884d8" 
                    activeDot={{ r: 8 }} 
                    name="账户价值"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 每日收益率图表 */}
      {performanceData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>每日收益率</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value) => `${Number(value).toFixed(2)}%`}
                    labelFormatter={(label) => `日期: ${label}`}
                  />
                  <Bar 
                    dataKey="dailyReturn" 
                    fill="#82ca9d" 
                    name="每日收益率"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 操作面板 */}
      <Card>
        <CardHeader>
          <CardTitle>账户操作</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 注资/提款 */}
            <div className="space-y-4">
              <h3 className="font-medium">资金操作</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <Label>日期</Label>
                  <Input 
                    type="date" 
                    value={cashDate} 
                    onChange={(e) => setCashDate(e.target.value)} 
                  />
                </div>
                <div>
                  <Label>类型</Label>
                  <select 
                    className="border rounded px-2 py-2 w-full" 
                    value={cashType} 
                    onChange={(e) => setCashType(e.target.value as any)}
                  >
                    <option value="DEPOSIT">注资</option>
                    <option value="WITHDRAW">提款</option>
                  </select>
                </div>
                <div>
                  <Label>金额</Label>
                  <Input 
                    type="number" 
                    value={cashAmount} 
                    onChange={(e) => setCashAmount(Number(e.target.value))} 
                  />
                </div>
              </div>
              <Button onClick={addCashflow} disabled={loading}>
                {loading ? "处理中..." : "执行"}
              </Button>
            </div>

            {/* 估值快照 */}
            <div className="space-y-4">
              <h3 className="font-medium">估值快照</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <Label>日期</Label>
                  <Input 
                    type="date" 
                    value={snapDate} 
                    onChange={(e) => setSnapDate(e.target.value)} 
                  />
                </div>
                <div>
                  <Label>总市值</Label>
                  <Input 
                    type="number" 
                    value={snapValue} 
                    onChange={(e) => setSnapValue(Number(e.target.value))} 
                  />
                </div>
              </div>
              <Button onClick={addSnapshot} disabled={loading}>
                {loading ? "保存中..." : "保存快照"}
              </Button>
            </div>

            {/* 转账 */}
            <div className="space-y-4 md:col-span-2">
              <h3 className="font-medium">账户间转账</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <Label>目标账户</Label>
                  <select 
                    className="border rounded px-2 py-2 w-full" 
                    value={transferTo} 
                    onChange={(e) => setTransferTo(e.target.value)}
                  >
                    <option value="">选择账户</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>金额</Label>
                  <Input 
                    type="number" 
                    value={transferAmount} 
                    onChange={(e) => setTransferAmount(Number(e.target.value))} 
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={transfer} disabled={loading} className="w-full">
                    {loading ? "转账中..." : "转账"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 交易记录 */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>变更记录</CardTitle>
            <div className="flex items-center gap-2">
              <Label>筛选:</Label>
              <select 
                className="border rounded px-2 py-1" 
                value={transactionFilter} 
                onChange={(e) => setTransactionFilter(e.target.value)}
              >
                <option value="ALL">全部</option>
                <option value="DEPOSIT">注资</option>
                <option value="WITHDRAW">提款</option>
                <option value="TRANSFER_IN">转入</option>
                <option value="TRANSFER_OUT">转出</option>
                <option value="VALUATION">估值</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">日期</th>
                  <th className="text-left py-2">类型</th>
                  <th className="text-left py-2">金额/市值</th>
                  <th className="text-left py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="border-b">
                    <td className="py-2">{new Date(tx.date).toLocaleDateString()}</td>
                    <td className="py-2">
                      {tx.isSnapshot ? "估值快照" : getTransactionTypeName(tx.type)}
                    </td>
                    <td className="py-2">
                      {formatCurrency(
                        tx.isSnapshot 
                          ? Number(tx.amount || 0)
                          : Number(tx.amount || 0) * (tx.type === "WITHDRAW" || tx.type === "TRANSFER_OUT" ? -1 : 1), 
                        tx.currency
                      )}
                    </td>
                    <td className="py-2">
                      {tx.isTransaction && (
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={() => deleteTransaction(tx.id)}
                          disabled={loading}
                        >
                          删除
                        </Button>
                      )}
                      {tx.isSnapshot && (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredTransactions.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                暂无变更记录
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}