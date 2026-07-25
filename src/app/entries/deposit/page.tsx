"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { postDeposit } from "@/lib/api/accounts";

/**
 * 存入记录页面组件
 *
 * 提供简单的存入交易表单，包含：
 * - 账户 ID
 * - 存入金额
 * - 发生时间
 * - 备注（可选）
 *
 * 注意：此为简化版页面，推荐使用 AccountsPage 中的 DepositDialog 弹窗。
 */
export default function DepositPage() {
  const [form, setForm] = useState({
    accountId: "",
    amount: "",
    occurredAt: "",
    note: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await postDeposit({
      accountId: form.accountId,
      amount: Number(form.amount),
      occurredAt: new Date(form.occurredAt).toISOString(),
      note: form.note,
    });
    setForm({ accountId: "", amount: "", occurredAt: "", note: "" });
  };

  return (
    <main className="p-6 max-w-md">
      <h1 className="text-xl font-bold mb-4">Deposit</h1>
      <form className="grid gap-2" onSubmit={handleSubmit}>
        <Label>Account ID</Label>
        <Input
          name="accountId"
          onChange={handleChange}
          placeholder="a1"
          value={form.accountId}
        />
        <Label>Amount</Label>
        <Input
          name="amount"
          onChange={handleChange}
          type="number"
          value={form.amount}
        />
        <Label>Occurred At</Label>
        <Input
          name="occurredAt"
          onChange={handleChange}
          type="datetime-local"
          value={form.occurredAt}
        />
        <Label>Note</Label>
        <Input
          name="note"
          onChange={handleChange}
          placeholder="可选"
          value={form.note}
        />
        <Button className="mt-2" type="submit">
          提交
        </Button>
      </form>
    </main>
  );
}
