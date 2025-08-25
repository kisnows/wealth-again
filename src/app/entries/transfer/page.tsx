"use client";

import { useState } from "react";

export default function TransferPage() {
  const [form, setForm] = useState({
    fromAccount: "",
    toAccount: "",
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
    await fetch("/api/v1/entries/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: { accountId: form.fromAccount, amount: Number(form.amount) },
        to: { accountId: form.toAccount },
        occurredAt: new Date(form.occurredAt).toISOString(),
        note: form.note,
      }),
    });
    setForm({
      fromAccount: "",
      toAccount: "",
      amount: "",
      occurredAt: "",
      note: "",
    });
  };

  return (
    <main className="p-6 max-w-md">
      <h1 className="text-xl font-bold mb-4">Transfer</h1>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          className="border p-2 w-full"
          name="fromAccount"
          value={form.fromAccount}
          onChange={handleChange}
          placeholder="From Account ID"
        />
        <input
          className="border p-2 w-full"
          name="toAccount"
          value={form.toAccount}
          onChange={handleChange}
          placeholder="To Account ID"
        />
        <input
          className="border p-2 w-full"
          name="amount"
          type="number"
          value={form.amount}
          onChange={handleChange}
          placeholder="Amount"
        />
        <input
          className="border p-2 w-full"
          name="occurredAt"
          type="datetime-local"
          value={form.occurredAt}
          onChange={handleChange}
        />
        <input
          className="border p-2 w-full"
          name="note"
          value={form.note}
          onChange={handleChange}
          placeholder="Note"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Submit
        </button>
      </form>
    </main>
  );
}
