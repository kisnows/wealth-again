"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewAccountPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    userId: "",
    name: "",
    accountType: "SAVINGS",
    subType: "",
    baseCurrency: "USD",
    initialBalance: "",
    description: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/v1/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        initialBalance: Number(form.initialBalance) || undefined,
      }),
    });
    router.push("/accounts");
  };

  return (
    <main className="p-6 max-w-md">
      <h1 className="text-xl font-bold mb-4">New Account</h1>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          className="border p-2 w-full"
          name="userId"
          value={form.userId}
          onChange={handleChange}
          placeholder="User ID"
        />
        <input
          className="border p-2 w-full"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Name"
        />
        <input
          className="border p-2 w-full"
          name="accountType"
          value={form.accountType}
          onChange={handleChange}
          placeholder="Account Type"
        />
        <input
          className="border p-2 w-full"
          name="subType"
          value={form.subType}
          onChange={handleChange}
          placeholder="Sub Type"
        />
        <input
          className="border p-2 w-full"
          name="baseCurrency"
          value={form.baseCurrency}
          onChange={handleChange}
          placeholder="Currency"
        />
        <input
          className="border p-2 w-full"
          type="number"
          name="initialBalance"
          value={form.initialBalance}
          onChange={handleChange}
          placeholder="Initial Balance"
        />
        <textarea
          className="border p-2 w-full"
          name="description"
          value={form.description}
          onChange={handleChange}
          placeholder="Description"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Create
        </button>
      </form>
    </main>
  );
}
