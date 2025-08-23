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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Account } from "@/types";

interface AccountOperationsNewProps {
  accountId: string;
  account: Account;
  onOperationComplete: () => void;
}

export default function AccountOperationsNew({
  accountId,
  account,
  onOperationComplete,
}: AccountOperationsNewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  // 存款状态
  const [depositAmount, setDepositAmount] = useState(0);
  const [depositDate, setDepositDate] = useState(new Date().toISOString().split("T")[0]);
  const [depositNote, setDepositNote] = useState("");

  // 取款状态
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [withdrawDate, setWithdrawDate] = useState(new Date().toISOString().split("T")[0]);
  const [withdrawNote, setWithdrawNote] = useState("");

  // 估值更新状态
  const [valuationAmount, setValuationAmount] = useState(0);
  const [valuationDate, setValuationDate] = useState(new Date().toISOString().split("T")[0]);

  // 账户编辑状态
  const [editName, setEditName] = useState(account.name);
  const [editSubType, setEditSubType] = useState(account.subType || "");
  const [editDescription, setEditDescription] = useState(account.description || "");

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const handleDeposit = async () => {
    if (depositAmount <= 0) {
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
          amount: depositAmount,
          tradeDate: depositDate,
          currency: account.baseCurrency,
          note: depositNote.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`成功存入 ¥${depositAmount.toLocaleString()}`);
        setDepositAmount(0);
        setDepositNote("");
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
    if (withdrawAmount <= 0) {
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
          amount: withdrawAmount,
          tradeDate: withdrawDate,
          currency: account.baseCurrency,
          note: withdrawNote.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`成功取出 ¥${withdrawAmount.toLocaleString()}`);
        setWithdrawAmount(0);
        setWithdrawNote("");
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
    if (valuationAmount <= 0) {
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
          totalValue: valuationAmount,
          asOf: valuationDate,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`成功更新估值为 ¥${valuationAmount.toLocaleString()}`);
        setValuationAmount(0);
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

  return (
    <Card className="w-full" data-testid="account-operations-new">
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

        <Tabs defaultValue="deposit" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="deposit">存款</TabsTrigger>
            <TabsTrigger value="withdraw">取款</TabsTrigger>
            <TabsTrigger value="valuation">估值</TabsTrigger>
            <TabsTrigger value="edit">编辑</TabsTrigger>
          </TabsList>

          <TabsContent value="deposit" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="depositAmount">存款金额 *</Label>
                <Input
                  id="depositAmount"
                  type="number"
                  value={depositAmount || ""}
                  onChange={(e) => setDepositAmount(Number(e.target.value))}
                  placeholder="请输入存款金额"
                  data-testid="deposit-amount-input"
                />
              </div>
              <div>
                <Label htmlFor="depositDate">存款日期 *</Label>
                <Input
                  id="depositDate"
                  type="date"
                  value={depositDate}
                  onChange={(e) => setDepositDate(e.target.value)}
                  data-testid="deposit-date-input"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="depositNote">备注（可选）</Label>
              <Textarea
                id="depositNote"
                value={depositNote}
                onChange={(e) => setDepositNote(e.target.value)}
                placeholder="存款说明"
                rows={2}
                data-testid="deposit-note-input"
              />
            </div>
            <Button onClick={handleDeposit} disabled={loading} data-testid="deposit-submit-button">
              {loading ? "处理中..." : "确认存款"}
            </Button>
          </TabsContent>

          <TabsContent value="withdraw" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="withdrawAmount">取款金额 *</Label>
                <Input
                  id="withdrawAmount"
                  type="number"
                  value={withdrawAmount || ""}
                  onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                  placeholder="请输入取款金额"
                  data-testid="withdraw-amount-input"
                />
              </div>
              <div>
                <Label htmlFor="withdrawDate">取款日期 *</Label>
                <Input
                  id="withdrawDate"
                  type="date"
                  value={withdrawDate}
                  onChange={(e) => setWithdrawDate(e.target.value)}
                  data-testid="withdraw-date-input"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="withdrawNote">备注（可选）</Label>
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
              data-testid="withdraw-submit-button"
            >
              {loading ? "处理中..." : "确认取款"}
            </Button>
          </TabsContent>

          <TabsContent value="valuation" className="space-y-4 mt-4">
            <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
              <p className="text-sm text-blue-700">
                💡 估值更新用于记录投资账户的市场价值。储蓄账户的估值始终等于本金，无需手动更新。
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="valuationAmount">最新估值 *</Label>
                <Input
                  id="valuationAmount"
                  type="number"
                  value={valuationAmount || ""}
                  onChange={(e) => setValuationAmount(Number(e.target.value))}
                  placeholder="请输入当前市值"
                  data-testid="valuation-amount-input"
                />
              </div>
              <div>
                <Label htmlFor="valuationDate">估值日期 *</Label>
                <Input
                  id="valuationDate"
                  type="date"
                  value={valuationDate}
                  onChange={(e) => setValuationDate(e.target.value)}
                  data-testid="valuation-date-input"
                />
              </div>
            </div>
            <Button
              onClick={handleValuationUpdate}
              disabled={loading || account.accountType === "SAVINGS"}
              data-testid="valuation-submit-button"
            >
              {loading ? "处理中..." : "更新估值"}
            </Button>
            {account.accountType === "SAVINGS" && (
              <p className="text-sm text-gray-500">储蓄账户的估值会自动计算，无需手动更新。</p>
            )}
          </TabsContent>

          <TabsContent value="edit" className="space-y-4 mt-4">
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
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
              <p className="text-sm text-yellow-700">
                ⚠️ 注意：账户币种和初始资金不能修改，以确保历史数据的一致性。
              </p>
            </div>
            <Button onClick={handleEditAccount} disabled={loading} data-testid="edit-submit-button">
              {loading ? "保存中..." : "保存修改"}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
