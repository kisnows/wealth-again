"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccountsSummary } from "@/lib/api/reports";
import { formatMoney } from "@/lib/domain/money";
import { useUserPrefsStore } from "@/lib/state/identity";
import DepositDialog from "@/components/modules/accounts/DepositDialog";
import TransferDialog from "@/components/modules/accounts/TransferDialog";
import ValuationFormDialog from "@/components/modules/accounts/ValuationFormDialog";
import WithdrawDialog from "@/components/modules/accounts/WithdrawDialog";
import { Skeleton } from "@/components/ui/skeleton";

export default function TopAccounts() {
  const { displayCurrency } = useUserPrefsStore();
  const { data, isLoading } = useAccountsSummary(displayCurrency ?? undefined);
  const items = (data?.items ?? [])
    .map((it) => ({
      ...it,
      value: Number(it.displayValue ?? it.valuation ?? 0),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  const [active, setActive] = useState<string | null>(null);
  return (
    <Card data-testid="dashboard-ui-top-accounts">
      <CardHeader className="items-start pb-0">
        <CardTitle className="text-base font-semibold text-foreground">
          账户概览（Top 5）
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {isLoading ? (
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
              {[
                "account-1",
                "account-2",
                "account-3",
                "account-4",
                "account-5",
              ].map((key) => (
                <TableRow key={`skeleton-${key}`}>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <Skeleton className="h-8 w-14" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
              {items.map((it) => {
                const formattedValue = formatMoney(
                  it.value,
                  displayCurrency ?? it.currency ?? "CNY",
                );
                return (
                  <TableRow
                    data-testid="dashboard-ui-top-accounts-row"
                    key={it.id}
                  >
                    <TableCell className="font-medium text-foreground">
                      <Link
                        className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                        href={`/accounts/${it.id}`}
                      >
                        {it.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formattedValue}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {it.roi == null ? "-" : `${(it.roi * 100).toFixed(2)}%`}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={() =>
                            setActive((prev) => (prev === it.id ? null : it.id))
                          }
                          size="sm"
                          variant="ghost"
                        >
                          {active === it.id ? "收起" : "快捷"}
                        </Button>
                      </div>
                      {active === it.id ? (
                        <div className="mt-2 flex flex-wrap justify-end gap-2">
                          <DepositDialog defaultAccountId={it.id} />
                          <WithdrawDialog defaultAccountId={it.id} />
                          <TransferDialog defaultFromId={it.id} />
                          {["INVESTMENT", "LOAN"].includes(
                            `${it.accountType ?? ""}`,
                          ) ? (
                            <ValuationFormDialog defaultAccountId={it.id} />
                          ) : null}
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
