"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Account {
  id: string;
  name: string;
  baseCurrency: string;
  initialBalance: string;
  createdAt: string;
  _count: {
    transactions: number;
    snapshots: number;
  };
}

export default function AccountManager() {
  const { data: session } = useSession();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [newAccountName, setNewAccountName] = useState("");
  const [initialBalance, setInitialBalance] = useState(0); // 添加初始资金状态
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  // 获取账户列表
  useEffect(() => {
    if (session) {
      fetchAccounts();
    }
  }, [session]);

  async function fetchAccounts() {
    try {
      const res = await fetch("/api/accounts");
      const data = await res.json();
      
      if (data.success) {
        setAccounts(data.data || []);
      } else {
        setError(data.error?.message || "获取账户列表失败");
      }
    } catch (error) {
      console.error("Error fetching accounts:", error);
      setError("网络错误，请稍后重试");
    }
  }

  async function deleteAccount(id: string, name: string) {
    if (!confirm(`确定要删除账户"${name}"吗？此操作将删除所有相关的交易记录和快照数据。`)) {
      return;
    }

    setLoading(true);
    setError("");
    
    try {
      const res = await fetch(`/api/accounts?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      
      if (data.success) {
        setSuccess("账户删除成功");
        await fetchAccounts();
      } else {
        setError(data.error?.message || "删除账户失败");
      }
    } catch (error) {
      console.error("Error deleting account:", error);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function createAccount() {
    if (!newAccountName.trim()) {
      setError("请输入账户名称");
      return;
    }
    
    setLoading(true);
    setError("");
    setSuccess("");
    
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: newAccountName, 
          baseCurrency: "CNY",
          initialBalance: initialBalance // 添加初始资金
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setSuccess("账户创建成功");
        setNewAccountName("");
        setInitialBalance(0); // 重置初始资金
        await fetchAccounts();
      } else {
        setError(data.error?.message || "创建账户失败");
      }
    } catch (error) {
      console.error("Error creating account:", error);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  if (!session) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-gray-500">请先登录以使用此功能</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>创建新账户</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          
          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              {success}
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="accountName">账户名称</Label>
              <Input
                id="accountName"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                placeholder="请输入账户名称"
                onKeyDown={(e) => e.key === "Enter" && createAccount()}
              />
            </div>
            <div>
              <Label htmlFor="initialBalance">初始资金</Label>
              <Input
                id="initialBalance"
                type="number"
                value={initialBalance}
                onChange={(e) => setInitialBalance(Number(e.target.value))}
                placeholder="请输入初始资金"
              />
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={createAccount} disabled={loading}>
              {loading ? "创建中..." : "创建账户"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>账户列表</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-center text-gray-500 py-8">暂无账户</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map((account) => (
                <Card key={account.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-semibold text-lg">{account.name}</h3>
                      <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {account.baseCurrency}
                      </span>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">初始资金：</span>
                        <span className="font-medium">¥{Number(account.initialBalance || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">交易记录：</span>
                        <span className="font-medium">{account._count.transactions}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">估值快照：</span>
                        <span className="font-medium">{account._count.snapshots}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">创建时间：</span>
                        <span className="font-medium">
                          {new Date(account.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button asChild variant="outline" size="sm" className="cursor-pointer flex-1">
                        <a href={`/investment/accounts/${account.id}`}>查看详情</a>
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => deleteAccount(account.id, account.name)}
                        disabled={loading}
                      >
                        删除
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}