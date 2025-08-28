"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccountsSummary } from "@/lib/api/reports";
import { useUserPrefsStore } from "@/lib/state/user-prefs";
import DepositDialog from "./DepositDialog";
import TransferDialog from "./TransferDialog";
import ValuationFormDialog from "./ValuationFormDialog";
import WithdrawDialog from "./WithdrawDialog";

export default function TopAccounts() {
  const { displayCurrency } = useUserPrefsStore();
  const { data, isLoading } = useAccountsSummary(displayCurrency ?? undefined);
  const items = (data?.items ?? [])
    .map((it: any) => ({
      ...it,
      value: Number(it.displayValue ?? it.valuation ?? 0),
    }))
    .sort((a: any, b: any) => b.value - a.value)
    .slice(0, 5);
  const [active, setActive] = useState<string | null>(null);
  return (
    <div className="border rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm text-muted-foreground">账户概览（Top 5）</h3>
      </div>
      {isLoading ? (
        <div className="text-sm text-muted-foreground">加载中…</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>估值</TableHead>
              <TableHead>ROI</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((it: any) => (
              <TableRow key={it.id}>
                <TableCell className="font-medium">
                  <Link className="underline" href={`/accounts/${it.id}`}>
                    {it.name}
                  </Link>
                </TableCell>
                <TableCell>{it.value.toLocaleString()}</TableCell>
                <TableCell>
                  {it.roi == null ? "-" : `${(it.roi * 100).toFixed(2)}%`}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setActive(it.id)}
                    >
                      快捷
                    </Button>
                  </div>
                  {active === it.id && (
                    <div className="flex gap-2 mt-2 justify-end">
                      <DepositDialog defaultAccountId={it.id} />
                      <WithdrawDialog defaultAccountId={it.id} />
                      <TransferDialog defaultFromId={it.id} />
                      <ValuationFormDialog defaultAccountId={it.id} />
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
