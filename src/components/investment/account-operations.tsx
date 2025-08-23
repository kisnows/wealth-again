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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Account } from "@/types";

interface AccountOperationsProps {
  accounts: Account[];
  onOperationComplete: () => void;
}

export default function AccountOperations({
  accounts,
  onOperationComplete,
}: AccountOperationsProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  // 存取款表单状态
  const [transactionForm, setTransactionForm] = useState({
    accountId: "",
    type: "DEPOSIT" as "DEPOSIT" | "WITHDRAW",
    amount: 0,
    note: "",
  });

  // 转账表单状态
  const [transferForm, setTransferForm] = useState({
    fromAccountId: "",
    toAccountId: "",
    amount: 0,
    note: "",
  });

  // 估值表单状态
  const [valuationForm, setValuationForm] = useState({
    accountId: "",
    totalValue: 0,
    note: "",
  });

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  // 处理存取款
  const handleTransaction = async () => {
    if (!transactionForm.accountId || transactionForm.amount <= 0) {
      setError("请选择账户并输入有效金额");
      return;
    }

    setLoading(true);
    clearMessages();

    try {
      const response = await fetch("/api/accounts/operations?action=transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transactionForm),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`${transactionForm.type === "DEPOSIT" ? "存款" : "取款"}操作成功`);
        setTransactionForm({ accountId: "", type: "DEPOSIT", amount: 0, note: "" });
        onOperationComplete();
      } else {
        setError(data.error?.message || "操作失败");
      }
    } catch (error) {
      console.error("Transaction error:", error);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  // 处理转账
  const handleTransfer = async () => {
    if (!transferForm.fromAccountId || !transferForm.toAccountId || transferForm.amount <= 0) {
      setError("请选择转出和转入账户，并输入有效金额");
      return;
    }

    if (transferForm.fromAccountId === transferForm.toAccountId) {
      setError("转出和转入账户不能相同");
      return;
    }

    setLoading(true);
    clearMessages();

    try {
      const response = await fetch("/api/accounts/operations?action=transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transferForm),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess("转账操作成功");
        setTransferForm({ fromAccountId: "", toAccountId: "", amount: 0, note: "" });
        onOperationComplete();
      } else {
        setError(data.error?.message || "转账失败");
      }
    } catch (error) {
      console.error("Transfer error:", error);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  // 处理估值更新
  const handleValuation = async () => {
    if (!valuationForm.accountId || valuationForm.totalValue < 0) {
      setError("请选择账户并输入有效估值");
      return;
    }

    setLoading(true);
    clearMessages();

    try {
      const response = await fetch("/api/accounts/operations?action=valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(valuationForm),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess("估值更新成功");
        setValuationForm({ accountId: "", totalValue: 0, note: "" });
        onOperationComplete();
      } else {
        setError(data.error?.message || "估值更新失败");
      }
    } catch (error) {
      console.error("Valuation error:", error);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const getAccountLabel = (account: Account) => {
    const typeLabel =
      account.accountType === "SAVINGS"
        ? "储蓄"
        : account.accountType === "INVESTMENT"
          ? "投资"
          : "借贷";
    return `${account.name} (${typeLabel} - ${account.baseCurrency})`;
  };

  // 获取可以手动设置估值的账户（排除储蓄账户）
  const valuationAccounts = accounts.filter((acc) => acc.accountType !== "SAVINGS");

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
    <Card>
      <CardHeader>
        <CardTitle>账户操作</CardTitle>
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

        <Tabs defaultValue="transaction" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="transaction">存取款</TabsTrigger>
            <TabsTrigger value="transfer">转账</TabsTrigger>
            <TabsTrigger value="valuation">估值更新</TabsTrigger>
          </TabsList>

          {/* 存取款 */}
          <TabsContent value="transaction">
            <div className="space-y-4">
              <div>
                <Label>选择账户</Label>
                <Select
                  value={transactionForm.accountId}
                  onValueChange={(value) =>
                    setTransactionForm({ ...transactionForm, accountId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="请选择要操作的账户" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {getAccountLabel(account)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>操作类型</Label>
                <Select
                  value={transactionForm.type}
                  onValueChange={(value: "DEPOSIT" | "WITHDRAW") =>
                    setTransactionForm({ ...transactionForm, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEPOSIT">存款（外部资金流入）</SelectItem>
                    <SelectItem value="WITHDRAW">取款（外部资金流出）</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>金额</Label>
                <Input
                  type="number"
                  value={transactionForm.amount}
                  onChange={(e) =>
                    setTransactionForm({
                      ...transactionForm,
                      amount: Number(e.target.value),
                    })
                  }
                  placeholder="请输入金额"
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <Label>备注（可选）</Label>
                <Textarea
                  value={transactionForm.note}
                  onChange={(e) => setTransactionForm({ ...transactionForm, note: e.target.value })}
                  placeholder="请输入备注信息"
                  rows={2}
                />
              </div>

              <Button onClick={handleTransaction} disabled={loading}>
                {loading
                  ? "处理中..."
                  : `确认${transactionForm.type === "DEPOSIT" ? "存款" : "取款"}`}
              </Button>
            </div>
          </TabsContent>

          {/* 转账 */}
          <TabsContent value="transfer">
            <div className="space-y-4">
              <div>
                <Label>转出账户</Label>
                <Select
                  value={transferForm.fromAccountId}
                  onValueChange={(value) =>
                    setTransferForm({ ...transferForm, fromAccountId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="请选择转出账户" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {getAccountLabel(account)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>转入账户</Label>
                <Select
                  value={transferForm.toAccountId}
                  onValueChange={(value) =>
                    setTransferForm({ ...transferForm, toAccountId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="请选择转入账户" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts
                      .filter((account) => account.id !== transferForm.fromAccountId)
                      .map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {getAccountLabel(account)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>转账金额</Label>
                <Input
                  type="number"
                  value={transferForm.amount}
                  onChange={(e) =>
                    setTransferForm({
                      ...transferForm,
                      amount: Number(e.target.value),
                    })
                  }
                  placeholder="请输入转账金额"
                  min="0"
                  step="0.01"
                />
                {transferForm.fromAccountId &&
                  transferForm.toAccountId &&
                  (() => {
                    const fromAccount = accounts.find((a) => a.id === transferForm.fromAccountId);
                    const toAccount = accounts.find((a) => a.id === transferForm.toAccountId);
                    if (
                      fromAccount &&
                      toAccount &&
                      fromAccount.baseCurrency !== toAccount.baseCurrency
                    ) {
                      return (
                        <p className="text-sm text-amber-600 mt-1">
                          ⚠️ 跨币种转账：{fromAccount.baseCurrency} → {toAccount.baseCurrency}
                          ，将自动按汇率转换
                        </p>
                      );
                    }
                    return null;
                  })()}
              </div>

              <div>
                <Label>备注（可选）</Label>
                <Textarea
                  value={transferForm.note}
                  onChange={(e) => setTransferForm({ ...transferForm, note: e.target.value })}
                  placeholder="请输入转账备注"
                  rows={2}
                />
              </div>

              <Button onClick={handleTransfer} disabled={loading}>
                {loading ? "转账中..." : "确认转账"}
              </Button>
            </div>
          </TabsContent>

          {/* 估值更新 */}
          <TabsContent value="valuation">
            <div className="space-y-4">
              <div>
                <Label>选择账户</Label>
                <Select
                  value={valuationForm.accountId}
                  onValueChange={(value) =>
                    setValuationForm({ ...valuationForm, accountId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="请选择要更新估值的账户" />
                  </SelectTrigger>
                  <SelectContent>
                    {valuationAccounts.length > 0 ? (
                      valuationAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {getAccountLabel(account)}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="" disabled>
                        暂无可更新估值的账户（储蓄账户估值自动等于本金）
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-600 mt-1">
                  💡 储蓄账户的估值会自动等于本金，无需手动设置
                </p>
              </div>

              <div>
                <Label>当前估值</Label>
                <Input
                  type="number"
                  value={valuationForm.totalValue}
                  onChange={(e) =>
                    setValuationForm({
                      ...valuationForm,
                      totalValue: Number(e.target.value),
                    })
                  }
                  placeholder="请输入当前账户总估值"
                  min="0"
                  step="0.01"
                />
                <p className="text-sm text-gray-600 mt-1">
                  💡 投资账户：反映市场价值；借贷账户：剩余负债金额
                </p>
              </div>

              <div>
                <Label>备注（可选）</Label>
                <Textarea
                  value={valuationForm.note}
                  onChange={(e) => setValuationForm({ ...valuationForm, note: e.target.value })}
                  placeholder="请输入估值备注（如估值来源、市场情况等）"
                  rows={2}
                />
              </div>

              <Button
                onClick={handleValuation}
                disabled={loading || valuationAccounts.length === 0}
              >
                {loading ? "更新中..." : "确认更新估值"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
