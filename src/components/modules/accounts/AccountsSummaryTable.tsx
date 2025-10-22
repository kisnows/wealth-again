"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AccountSummaryItem } from "@/lib/api/reports";
import { formatMoney } from "@/lib/domain/money";
import { cn } from "@/lib/utils";

type AccountsSummaryTableProps = {
  items: AccountSummaryItem[];
  displayCurrency?: string | null;
  isLoading: boolean;
  testId?: string;
};

export function AccountsSummaryTable({
  items,
  displayCurrency,
  isLoading,
  testId = "accounts-ui-summary-table",
}: AccountsSummaryTableProps) {
  if (isLoading) {
    return (
      <div
        className="py-8 text-center text-sm text-muted-foreground"
        data-testid={`${testId}-loading`}
      >
        加载中…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div
        className="py-8 text-center text-sm text-muted-foreground"
        data-testid={`${testId}-empty`}
      >
        暂无账户数据，请先创建账户。
      </div>
    );
  }

  return (
    <Table
      className="text-sm"
      data-testid={testId}
    >
      <TableHeader className="[&_th]:whitespace-nowrap [&_th]:px-3 [&_th]:py-2 [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:text-muted-foreground/80">
        <TableRow className="border-b border-border/70">
          <TableHead>名称</TableHead>
          <TableHead>本金</TableHead>
          <TableHead>估值</TableHead>
          <TableHead>收益</TableHead>
          <TableHead>ROI</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const currency = displayCurrency ?? item.currency;
          const profit = Number.isFinite(item.profit) ? item.profit : 0;
          const roi = Number.isFinite(item.roi) ? item.roi : null;
          const profitTone =
            profit > 0
              ? "text-emerald-600 dark:text-emerald-400"
              : profit < 0
                ? "text-destructive"
                : "text-muted-foreground";
          const roiTone =
            roi == null
              ? "text-muted-foreground"
              : roi > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : roi < 0
                  ? "text-destructive"
                  : "text-muted-foreground";
          return (
            <TableRow
              className="border-b border-border/40 transition-colors hover:bg-muted/40 [&>td]:px-3 [&>td]:py-2"
              data-testid={`${testId}-row`}
              key={item.id}
            >
              <TableCell className="font-medium text-foreground">
                {item.name}
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {formatMoney(item.principal, currency)}
              </TableCell>
              <TableCell className="font-mono text-xs text-foreground">
                {formatMoney(item.displayValue ?? item.valuation, currency)}
              </TableCell>
              <TableCell className={cn("font-mono text-xs", profitTone)}>
                {formatMoney(item.profit, currency)}
              </TableCell>
              <TableCell className={cn("font-mono text-xs", roiTone)}>
                {roi == null ? "-" : `${(roi * 100).toFixed(2)}%`}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
