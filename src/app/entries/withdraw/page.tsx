"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { postWithdraw } from "@/lib/api/accounts";

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
