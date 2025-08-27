"use client";

import { useAccounts } from "@/lib/api/accounts";
import AccountTable from "@/components/modules/AccountTable";
import TransferDialog from "@/components/modules/TransferDialog";
import ValuationFormDialog from "@/components/modules/ValuationFormDialog";
import CreateAccountDialog from "@/components/modules/CreateAccountDialog";

export default function AccountsPage() {
  const { data, isLoading, error } = useAccounts();
  return (
    <main className="p-6">
      <h1 className="text-xl font-bold mb-4">Accounts</h1>
      {isLoading && <div className="text-sm text-muted-foreground">加载中…</div>}
      {error && <div className="text-sm text-red-500">加载失败</div>}
      <div className="flex gap-3 mb-3">
        <CreateAccountDialog />
        <TransferDialog />
        <ValuationFormDialog />
      </div>
      {!isLoading && !error && <AccountTable />}
    </main>
  );
}
