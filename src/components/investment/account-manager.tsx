"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Account, AccountStatus, AccountType } from "@/types";

export default function AccountManager() {
  const { data: session } = useSession();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountType, setNewAccountType] = useState<AccountType>("INVESTMENT");
  const [newSubType, setNewSubType] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [initialBalance, setInitialBalance] = useState(0);
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

  async function archiveAccount(id: string, name: string) {
    if (
      !confirm(`确定要归档账户"${name}"吗？归档后账户将不再显示在主列表中，但历史数据会被保留。`)
    ) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ARCHIVED" }),
      });
      const data = await res.json();

      if (data.success) {
        setSuccess("账户已归档");
        await fetchAccounts();
      } else {
        setError(data.error?.message || "归档账户失败");
      }
    } catch (error) {
      console.error("Error archiving account:", error);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
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
          accountType: newAccountType,
          subType: newSubType.trim() || undefined,
          description: newDescription.trim() || undefined,
          baseCurrency: "CNY",
          initialBalance: initialBalance,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess("账户创建成功");
        setNewAccountName("");
        setNewSubType("");
        setNewDescription("");
        setInitialBalance(0);
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

  const getAccountTypeLabel = (type: AccountType) => {
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

  const getAccountTypeColor = (type: AccountType) => {
    switch (type) {
      case "SAVINGS":
        return "bg-green-100 text-green-800";
      case "INVESTMENT":
        return "bg-blue-100 text-blue-800";
      case "LOAN":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (!session) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-gray-500">请先登录以使用此功能</p>
        </CardContent>
      </Card>
    );
  }

  // 按账户类型分组
  const activeAccounts = accounts.filter((acc) => acc.status === "ACTIVE");
  const accountsByType = activeAccounts.reduce(
    (groups, account) => {
      const type = account.accountType || "INVESTMENT";
      if (!groups[type]) groups[type] = [];
      groups[type].push(account);
      return groups;
    },
    {} as Record<AccountType, Account[]>,
  );

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
              <Label htmlFor="accountName">账户名称 *</Label>
              <Input
                id="accountName"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                placeholder="请输入账户名称"
                onKeyDown={(e) => e.key === "Enter" && createAccount()}
              />
            </div>
            <div>
              <Label htmlFor="accountType">账户类型 *</Label>
              <Select
                value={newAccountType}
                onValueChange={(value: AccountType) => setNewAccountType(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择账户类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SAVINGS">储蓄账户（流动资金）</SelectItem>
                  <SelectItem value="INVESTMENT">投资账户（长期资金）</SelectItem>
                  <SelectItem value="LOAN">借贷账户（负债）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="subType">子类型（可选）</Label>
              <Input
                id="subType"
                value={newSubType}
                onChange={(e) => setNewSubType(e.target.value)}
                placeholder="如：定期存款、股票账户、房贷等"
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
            <Label htmlFor="description">描述（可选）</Label>
            <Textarea
              id="description"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="账户描述信息"
              rows={2}
            />
          </div>
          <div className="mt-4">
            <Button onClick={createAccount} disabled={loading}>
              {loading ? "创建中..." : "创建账户"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 按类型显示账户 */}
      {Object.entries(accountsByType).map(([type, typeAccounts]) => (
        <Card key={type}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span
                className={`px-2 py-1 rounded text-sm font-medium ${getAccountTypeColor(type as AccountType)}`}
              >
                {getAccountTypeLabel(type as AccountType)}
              </span>
              <span className="text-gray-500">({typeAccounts.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {typeAccounts.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                暂无{getAccountTypeLabel(type as AccountType)}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {typeAccounts.map((account) => (
                  <Card key={account.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-semibold text-lg">{account.name}</h3>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {account.baseCurrency}
                          </span>
                          {account.subType && (
                            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                              {account.subType}
                            </span>
                          )}
                        </div>
                      </div>

                      {account.description && (
                        <p className="text-sm text-gray-600 mb-3">{account.description}</p>
                      )}

                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">初始资金：</span>
                          <span className="font-medium">
                            ¥{Number(account.initialBalance || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">累计存款：</span>
                          <span className="font-medium">
                            ¥{Number(account.totalDeposits || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">累计取款：</span>
                          <span className="font-medium">
                            ¥{Number(account.totalWithdrawals || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">交易记录：</span>
                          <span className="font-medium">{account._count?.transactions || 0}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">估值快照：</span>
                          <span className="font-medium">{account._count?.snapshots || 0}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">创建时间：</span>
                          <span className="font-medium">
                            {new Date(account.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="cursor-pointer flex-1"
                        >
                          <a href={`/investment/accounts/${account.id}`}>查看详情</a>
                        </Button>
                        {account._count?.transactions === 0 ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteAccount(account.id, account.name)}
                            disabled={loading}
                          >
                            删除
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => archiveAccount(account.id, account.name)}
                            disabled={loading}
                          >
                            归档
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
