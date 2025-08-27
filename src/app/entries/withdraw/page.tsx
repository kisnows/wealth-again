"use client";

import { useState } from "react";
import { postWithdraw } from "@/lib/api/accounts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function WithdrawPage() {
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
    await postWithdraw({
      accountId: form.accountId,
      amount: Number(form.amount),
      occurredAt: new Date(form.occurredAt).toISOString(),
      note: form.note,
    });
    setForm({ accountId: "", amount: "", occurredAt: "", note: "" });
  };

  return (
    <main className="p-6 max-w-md">
      <h1 className="text-xl font-bold mb-4">Withdraw</h1>
      <form onSubmit={handleSubmit} className="grid gap-2">
        <Label>Account ID</Label>
        <Input name="accountId" value={form.accountId} onChange={handleChange} placeholder="a1" />
        <Label>Amount</Label>
        <Input name="amount" type="number" value={form.amount} onChange={handleChange} />
        <Label>Occurred At</Label>
        <Input name="occurredAt" type="datetime-local" value={form.occurredAt} onChange={handleChange} />
        <Label>Note</Label>
        <Input name="note" value={form.note} onChange={handleChange} placeholder="可选" />
        <Button type="submit" className="mt-2">提交</Button>
      </form>
    </main>
  );
}
