"use client";

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
import type { Account } from "@/types";

interface AccountOperationsPanelProps {
  accountId: string;
  account: Account;
  accounts: Account[]; // 其他账户用于转账
  onOperationComplete: () => void;
}

export default function AccountOperationsPanel({
  accountId,
  account,
  accounts,
  onOperationComplete,
}: AccountOperationsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  // 存款状态
  const [depositAmount, setDepositAmount] = useState("");
  const [depositDate, setDepositDate] = useState(new Date().toISOString().split("T")[0]);
  const [depositNote, setDepositNote] = useState("");

  // 取款状态
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawDate, setWithdrawDate] = useState(new Date().toISOString().split("T")[0]);
  const [withdrawNote, setWithdrawNote] = useState("");

  // 估值更新状态
  const [valuationAmount, setValuationAmount] = useState("");
  const [valuationDate, setValuationDate] = useState(new Date().toISOString().split("T")[0]);

  // 转账状态
  const [transferToAccountId, setTransferToAccountId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split("T")[0]);
  const [transferNote, setTransferNote] = useState("");

  // 账户编辑状态
  const [editName, setEditName] = useState(account.name);
  const [editSubType, setEditSubType] = useState(account.subType || "");
  const [editDescription, setEditDescription] = useState(account.description || "");

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const clearForm = (formType: string) => {
    switch (formType) {
      case "deposit":
        setDepositAmount("");
        setDepositNote("");
        break;
      case "withdraw":
        setWithdrawAmount("");
        setWithdrawNote("");
        break;
      case "valuation":
        setValuationAmount("");
        break;
      case "transfer":
        setTransferAmount("");
        setTransferToAccountId("");
        setTransferNote("");
        break;
    }
  };

  const handleDeposit = async () => {
    if (!depositAmount || Number(depositAmount) <= 0) {
      setError("请输入有效的存款金额");
      return;
    }

    setLoading(true);
    clearMessages();

    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          type: "DEPOSIT",
          amount: Number(depositAmount),
          tradeDate: depositDate,
          currency: account.baseCurrency,
          note: depositNote.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`成功存入 ¥${Number(depositAmount).toLocaleString()}`);
        clearForm("deposit");
        onOperationComplete();
      } else {
        setError(data.error?.message || "存款操作失败");
      }
    } catch (error) {
      console.error("Deposit error:", error);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || Number(withdrawAmount) <= 0) {
      setError("请输入有效的取款金额");
      return;
    }

    setLoading(true);
    clearMessages();

    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          type: "WITHDRAW",
          amount: Number(withdrawAmount),
          tradeDate: withdrawDate,
          currency: account.baseCurrency,
          note: withdrawNote.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`成功取出 ¥${Number(withdrawAmount).toLocaleString()}`);
        clearForm("withdraw");
        onOperationComplete();
      } else {
        setError(data.error?.message || "取款操作失败");
      }
    } catch (error) {
      console.error("Withdraw error:", error);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleValuationUpdate = async () => {
    if (!valuationAmount || Number(valuationAmount) <= 0) {
      setError("请输入有效的估值金额");
      return;
    }

    setLoading(true);
    clearMessages();

    try {
      const response = await fetch(`/api/accounts/${accountId}/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalValue: Number(valuationAmount),
          asOf: valuationDate,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`成功更新估值为 ¥${Number(valuationAmount).toLocaleString()}`);
        clearForm("valuation");
        onOperationComplete();
      } else {
        setError(data.error?.message || "估值更新失败");
      }
    } catch (error) {
      console.error("Valuation update error:", error);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferAmount || Number(transferAmount) <= 0) {
      setError("请输入有效的转账金额");
      return;
    }
    if (!transferToAccountId) {
      setError("请选择转入账户");
      return;
    }

    setLoading(true);
    clearMessages();

    try {
      const response = await fetch("/api/transactions/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAccountId: accountId,
          toAccountId: transferToAccountId,
          amount: Number(transferAmount),
          tradeDate: transferDate,
          note: transferNote.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`成功转账 ¥${Number(transferAmount).toLocaleString()}`);
        clearForm("transfer");
        onOperationComplete();
      } else {
        setError(data.error?.message || "转账操作失败");
      }
    } catch (error) {
      console.error("Transfer error:", error);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleEditAccount = async () => {
    if (!editName.trim()) {
      setError("请输入账户名称");
      return;
    }

    setLoading(true);
    clearMessages();

    try {
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          subType: editSubType.trim() || undefined,
          description: editDescription.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess("账户信息更新成功");
        onOperationComplete();
      } else {
        setError(data.error?.message || "更新账户信息失败");
      }
    } catch (error) {
      console.error("Edit account error:", error);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  // 过滤可转账的账户（排除当前账户）
  const transferableAccounts = accounts.filter(
    (acc) => acc.id !== accountId && acc.status === "ACTIVE",
  );

  return (
    <div className="space-y-6" data-testid="account-operations-panel">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* 存款操作 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-green-700">💰 存款</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="depositAmount">存款金额 *</Label>
              <Input
                id="depositAmount"
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="请输入存款金额"
                data-testid="deposit-amount-input"
              />
            </div>
            <div>
              <Label htmlFor="depositDate">存款日期</Label>
              <Input
                id="depositDate"
                type="date"
                value={depositDate}
                onChange={(e) => setDepositDate(e.target.value)}
                data-testid="deposit-date-input"
              />
            </div>
            <div>
              <Label htmlFor="depositNote">备注</Label>
              <Textarea
                id="depositNote"
                value={depositNote}
                onChange={(e) => setDepositNote(e.target.value)}
                placeholder="存款说明"
                rows={2}
                data-testid="deposit-note-input"
              />
            </div>
            <Button
              onClick={handleDeposit}
              disabled={loading}
              className="w-full"
              data-testid="deposit-submit-button"
            >
              {loading ? "处理中..." : "确认存款"}
            </Button>
          </CardContent>
        </Card>

        {/* 取款操作 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-red-700">🏧 取款</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="withdrawAmount">取款金额 *</Label>
              <Input
                id="withdrawAmount"
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="请输入取款金额"
                data-testid="withdraw-amount-input"
              />
            </div>
            <div>
              <Label htmlFor="withdrawDate">取款日期</Label>
              <Input
                id="withdrawDate"
                type="date"
                value={withdrawDate}
                onChange={(e) => setWithdrawDate(e.target.value)}
                data-testid="withdraw-date-input"
              />
            </div>
            <div>
              <Label htmlFor="withdrawNote">备注</Label>
              <Textarea
                id="withdrawNote"
                value={withdrawNote}
                onChange={(e) => setWithdrawNote(e.target.value)}
                placeholder="取款说明"
                rows={2}
                data-testid="withdraw-note-input"
              />
            </div>
            <Button
              onClick={handleWithdraw}
              disabled={loading}
              className="w-full"
              data-testid="withdraw-submit-button"
            >
              {loading ? "处理中..." : "确认取款"}
            </Button>
          </CardContent>
        </Card>

        {/* 估值更新 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-blue-700">📊 估值更新</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {account.accountType === "SAVINGS" && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
                <p className="text-sm text-yellow-700">💡 储蓄账户的估值会自动计算，无需手动更新</p>
              </div>
            )}
            <div>
              <Label htmlFor="valuationAmount">最新估值 *</Label>
              <Input
                id="valuationAmount"
                type="number"
                value={valuationAmount}
                onChange={(e) => setValuationAmount(e.target.value)}
                placeholder="请输入当前市值"
                disabled={account.accountType === "SAVINGS"}
                data-testid="valuation-amount-input"
              />
            </div>
            <div>
              <Label htmlFor="valuationDate">估值日期</Label>
              <Input
                id="valuationDate"
                type="date"
                value={valuationDate}
                onChange={(e) => setValuationDate(e.target.value)}
                disabled={account.accountType === "SAVINGS"}
                data-testid="valuation-date-input"
              />
            </div>
            <Button
              onClick={handleValuationUpdate}
              disabled={loading || account.accountType === "SAVINGS"}
              className="w-full"
              data-testid="valuation-submit-button"
            >
              {loading ? "处理中..." : "更新估值"}
            </Button>
          </CardContent>
        </Card>

        {/* 转账操作 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-purple-700">🔄 转账</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="transferAmount">转账金额 *</Label>
              <Input
                id="transferAmount"
                type="number"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="请输入转账金额"
                data-testid="transfer-amount-input"
              />
            </div>
            <div>
              <Label htmlFor="transferToAccount">转入账户 *</Label>
              <Select value={transferToAccountId} onValueChange={setTransferToAccountId}>
                <SelectTrigger data-testid="transfer-to-account-select">
                  <SelectValue placeholder="选择转入账户" />
                </SelectTrigger>
                <SelectContent>
                  {transferableAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} ({acc.baseCurrency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="transferDate">转账日期</Label>
              <Input
                id="transferDate"
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                data-testid="transfer-date-input"
              />
            </div>
            <div>
              <Label htmlFor="transferNote">备注</Label>
              <Textarea
                id="transferNote"
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                placeholder="转账说明"
                rows={2}
                data-testid="transfer-note-input"
              />
            </div>
            <Button
              onClick={handleTransfer}
              disabled={loading || transferableAccounts.length === 0}
              className="w-full"
              data-testid="transfer-submit-button"
            >
              {loading ? "处理中..." : "确认转账"}
            </Button>
            {transferableAccounts.length === 0 && (
              <p className="text-sm text-gray-500">没有可转账的账户</p>
            )}
          </CardContent>
        </Card>

        {/* 账户编辑 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg text-gray-700">✏️ 编辑账户</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editName">账户名称 *</Label>
                <Input
                  id="editName"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="请输入账户名称"
                  data-testid="edit-name-input"
                />
              </div>
              <div>
                <Label htmlFor="editSubType">子类型</Label>
                <Input
                  id="editSubType"
                  value={editSubType}
                  onChange={(e) => setEditSubType(e.target.value)}
                  placeholder="如：定期存款、股票账户等"
                  data-testid="edit-subtype-input"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="editDescription">账户描述</Label>
              <Textarea
                id="editDescription"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="账户描述信息"
                rows={3}
                data-testid="edit-description-input"
              />
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
              <p className="text-sm text-yellow-700">
                ⚠️ 注意：账户币种和初始资金不能修改，以确保历史数据的一致性。
              </p>
            </div>
            <Button onClick={handleEditAccount} disabled={loading} data-testid="edit-submit-button">
              {loading ? "保存中..." : "保存修改"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
