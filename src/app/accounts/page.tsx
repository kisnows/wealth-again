"use client";

import { useEffect, useState } from "react";

interface Account {
  id: string;
  name: string;
  accountType: string;
  baseCurrency: string;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    fetch("/api/v1/accounts")
      .then((res) => res.json())
      .then((data) => setAccounts(data))
      .catch(() => setAccounts([]));
  }, []);

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold mb-4">Accounts</h1>
      <ul className="space-y-2">
        {accounts.map((acc) => (
          <li key={acc.id} className="border p-2 rounded">
            {acc.name}{" "}
            <span className="text-sm text-muted-foreground">
              ({acc.baseCurrency})
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
