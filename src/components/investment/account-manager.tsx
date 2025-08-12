"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Account {
  id: string;
  name: string;
  baseCurrency: string;
  createdAt: string;
}

export default function AccountManager() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [newAccountName, setNewAccountName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取账户列表
  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    try {
      const res = await fetch("/api/accounts");
      const data = await res.json();
      setAccounts(data.accounts || []);
    } catch (error) {
      console.error("Error fetching accounts:", error);
    }
  }

  async function deleteAccount(id: string) {
    await fetch(`/api/accounts?id=${id}`, { method: "DELETE" });
    await fetchAccounts();
  }

  async function createAccount() {
    if (!newAccountName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newAccountName, baseCurrency: "CNY" }),
      });
      if (res.status === 409) {
        setError("账户名已存在，请更换名称");
        return;
      }
      if (!res.ok) {
        setError("创建账户失败");
        return;
      }
      setNewAccountName("");
      await fetchAccounts();
    } catch (error) {
      console.error("Error creating account:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>创建新账户</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <div className="mb-2 text-sm text-red-600">{error}</div>}
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="accountName">账户名称</Label>
              <Input
                id="accountName"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                placeholder="请输入账户名称"
              />
            </div>
            <div className="self-end">
              <Button onClick={createAccount} disabled={loading}>
                {loading ? "创建中..." : "创建账户"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>账户列表</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-gray-500">暂无账户</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map((account) => (
                <Card key={account.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <h3 className="font-semibold">{account.name}</h3>
                    <p className="text-sm text-gray-500">货币: {account.baseCurrency}</p>
                    <p className="text-sm text-gray-500">
                      创建时间: {new Date(account.createdAt).toLocaleDateString()}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button asChild variant="outline" size="sm" className="cursor-pointer">
                        <a href={`/investment/accounts/${account.id}`}>查看详情</a>
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => deleteAccount(account.id)}>删除</Button>
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