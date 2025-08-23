"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
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

interface AccountGridProps {
  accounts: Account[];
  loading: boolean;
  onRefresh: () => void;
}

export default function AccountGridNew({ accounts, loading, onRefresh }: AccountGridProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountType, setNewAccountType] = useState<AccountType>("INVESTMENT");
  const [newSubType, setNewSubType] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [initialBalance, setInitialBalance] = useState(0);
  const [baseCurrency, setBaseCurrency] = useState("CNY");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  async function createAccount() {
    if (!newAccountName.trim()) {
      setError("请输入账户名称");
      return;
    }

    setSubmitting(true);
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
          baseCurrency: baseCurrency,
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
        setShowCreateForm(false);
        onRefresh();
      } else {
        setError(data.error?.message || "创建账户失败");
      }
    } catch (error) {
      console.error("Error creating account:", error);
      setError("网络错误，请稍后重试");
    } finally {
      setSubmitting(false);
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
        return "bg-green-100 text-green-800 border-green-200";
      case "INVESTMENT":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "LOAN":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const calculateAccountValue = (account: Account) => {
    const principal =
      Number(account.initialBalance || 0) +
      Number(account.totalDeposits || 0) -
      Number(account.totalWithdrawals || 0);
    return principal;
  };

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
    <div className="space-y-6" data-testid="account-grid">
      {/* 添加账户卡片 */}
      <Card className="border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors">
        <CardContent className="pt-6">
          {!showCreateForm ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl text-gray-400">+</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">添加新账户</h3>
              <p className="text-gray-500 mb-4">创建储蓄、投资或借贷账户</p>
              <Button
                onClick={() => setShowCreateForm(true)}
                variant="outline"
                data-testid="add-account-button"
              >
                创建账户
              </Button>
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-4">
                <CardTitle>创建新账户</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCreateForm(false);
                    setError("");
                    setSuccess("");
                  }}
                  data-testid="cancel-create-button"
                >
                  取消
                </Button>
              </div>

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
                    data-testid="account-name-input"
                  />
                </div>
                <div>
                  <Label htmlFor="accountType">账户类型 *</Label>
                  <Select
                    value={newAccountType}
                    onValueChange={(value: AccountType) => setNewAccountType(value)}
                  >
                    <SelectTrigger data-testid="account-type-select">
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
                    data-testid="sub-type-input"
                  />
                </div>
                <div>
                  <Label htmlFor="baseCurrency">账户币种</Label>
                  <Select value={baseCurrency} onValueChange={setBaseCurrency}>
                    <SelectTrigger data-testid="currency-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CNY">人民币 (CNY)</SelectItem>
                      <SelectItem value="USD">美元 (USD)</SelectItem>
                      <SelectItem value="HKD">港币 (HKD)</SelectItem>
                      <SelectItem value="EUR">欧元 (EUR)</SelectItem>
                      <SelectItem value="JPY">日元 (JPY)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="initialBalance">初始资金</Label>
                  <Input
                    id="initialBalance"
                    type="number"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(Number(e.target.value))}
                    placeholder="请输入初始资金"
                    data-testid="initial-balance-input"
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
                  data-testid="description-input"
                />
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  onClick={createAccount}
                  disabled={submitting}
                  data-testid="create-account-submit"
                >
                  {submitting ? "创建中..." : "创建账户"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateForm(false);
                    setError("");
                    setSuccess("");
                  }}
                >
                  取消
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 现有账户列表 */}
      {Object.entries(accountsByType).map(([type, typeAccounts]) => (
        <div key={type}>
          <div className="flex items-center gap-3 mb-4">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium border ${getAccountTypeColor(type as AccountType)}`}
            >
              {getAccountTypeLabel(type as AccountType)}
            </span>
            <span className="text-gray-500">({typeAccounts.length})</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {typeAccounts.map((account) => (
              <Card
                key={account.id}
                className="hover:shadow-lg transition-all duration-200 cursor-pointer border-l-4 border-l-blue-500"
                onClick={() => router.push(`/investment/accounts/${account.id}`)}
                data-testid={`account-card-${account.id}`}
              >
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg truncate" title={account.name}>
                        {account.name}
                      </h3>
                      {account.subType && (
                        <span className="inline-block text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded mt-1">
                          {account.subType}
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded ml-2">
                      {account.baseCurrency}
                    </span>
                  </div>

                  {account.description && (
                    <p
                      className="text-sm text-gray-600 mb-4 line-clamp-2"
                      title={account.description}
                    >
                      {account.description}
                    </p>
                  )}

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">当前价值</span>
                      <span className="font-semibold text-lg">
                        ¥{calculateAccountValue(account).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">累计存款</span>
                      <span className="text-green-600">
                        +¥{Number(account.totalDeposits || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">累计取款</span>
                      <span className="text-red-600">
                        -¥{Number(account.totalWithdrawals || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="pt-2 border-t">
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>{account._count?.transactions || 0} 笔交易</span>
                        <span>{account._count?.snapshots || 0} 个快照</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <div className="text-xs text-gray-500">
                      创建于 {new Date(account.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {activeAccounts.length === 0 && !showCreateForm && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl text-gray-400">📊</span>
              </div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">还没有账户</h3>
              <p className="text-gray-500 mb-4">创建您的第一个账户开始管理资产</p>
              <Button onClick={() => setShowCreateForm(true)}>创建账户</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
