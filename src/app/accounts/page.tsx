"use client";

import AccountTable from "@/components/modules/AccountTable";
import CreateAccountDialog from "@/components/modules/CreateAccountDialog";
import TransferDialog from "@/components/modules/TransferDialog";
import ValuationFormDialog from "@/components/modules/ValuationFormDialog";
import { useAccounts } from "@/lib/api/accounts";

export default function AccountsPage() {
  const { isLoading, error } = useAccounts();
  return (
    <main className="p-6">
      <h1 className="text-xl font-bold mb-4">Accounts</h1>
      {isLoading && (
        <div className="text-sm text-muted-foreground">加载中…</div>
      )}
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
