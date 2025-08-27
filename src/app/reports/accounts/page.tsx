"use client";

import { useAccountsSummary } from "@/lib/api/reports";
import { useUserPrefsStore } from "@/lib/state/user-prefs";
import { formatMoney } from "@/lib/domain/money";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ReportsAccountsPage() {
  const { displayCurrency } = useUserPrefsStore();
  const { data, isLoading } = useAccountsSummary(displayCurrency ?? undefined);
  const items = data?.items ?? [];
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">账户汇总</h1>
      {isLoading ? (
        <div className="text-sm text-muted-foreground">加载中…</div>
      ) : (
        <div className="border rounded">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>本金</TableHead>
                <TableHead>估值</TableHead>
                <TableHead>收益</TableHead>
                <TableHead>ROI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it: any) => (
                <TableRow key={it.id}>
                  <TableCell className="font-medium">{it.name}</TableCell>
                  <TableCell>{formatMoney(it.principal, displayCurrency ?? it.currency)}</TableCell>
                  <TableCell>{formatMoney(it.displayValue ?? it.valuation, displayCurrency ?? it.currency)}</TableCell>
                  <TableCell>{formatMoney(it.profit, displayCurrency ?? it.currency)}</TableCell>
                  <TableCell>{it.roi == null ? "-" : `${(it.roi * 100).toFixed(2)}%`}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  );
}

