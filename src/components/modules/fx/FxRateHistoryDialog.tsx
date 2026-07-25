"use client";

import { useMemo } from "react";
import useSWR from "swr";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { formatCurrencyLabel } from "@/lib/domain/currency";
import { getJson } from "@/lib/utils/fetcher";

const DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function buildChartPoints(
  items: Array<{
    effectiveFrom: string;
    effectiveTo: string | null;
    rate: number;
  }>,
) {
  const points: Array<{ date: string; rate: number }> = [];
  items.forEach((item, index) => {
    const startDate = new Date(item.effectiveFrom);
    points.push({
      date: startDate.toISOString(),
      rate: item.rate,
    });
    if (item.effectiveTo) {
      const endDate = new Date(item.effectiveTo);
      const isNextSameStart =
        index < items.length - 1 &&
        new Date(items[index + 1].effectiveFrom).getTime() ===
          endDate.getTime();
      if (!isNextSameStart) {
        points.push({ date: endDate.toISOString(), rate: item.rate });
      }
    }
  });
  return points;
}

type FxRateHistoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  base?: string;
  quote: string | null;
};

export default function FxRateHistoryDialog({
  open,
  onOpenChange,
  base = "USD",
  quote,
}: FxRateHistoryDialogProps) {
  const { data, isLoading, error } = useSWR<
    | {
        base: string;
        quote: string;
        items: Array<{
          id: string;
          rate: number;
          effectiveFrom: string;
          effectiveTo: string | null;
          createdAt: string;
        }>;
      }
    | null
  >(
    open && quote ? `/api/v1/fx/rates/history?base=${base}&quote=${quote}` : null,
    getJson,
    {
      revalidateOnFocus: false,
    },
  );

  const chartPoints = useMemo(() => {
    if (!data?.items?.length) return [] as Array<{ date: string; rate: number }>;
    return buildChartPoints(data.items);
  }, [data?.items]);

  const currencyLabel = quote ? formatCurrencyLabel(quote) : "";
  const baseLabel = base ? formatCurrencyLabel(base) : "";

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-4xl" data-testid="accounts-ui-fx-history-dialog">
        <DialogHeader>
          <DialogTitle>汇率历史 · {currencyLabel}</DialogTitle>
          <DialogDescription>
            基础币种：{baseLabel}。展示所有已录入的汇率区间，并提供随时间的变动趋势。
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            汇率历史加载失败，请稍后重试。
          </div>
        ) : isLoading ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            正在加载历史汇率…
          </div>
        ) : !data?.items?.length ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            暂无历史记录
          </div>
        ) : (
          <div className="space-y-6">
            <div className="h-64 w-full rounded-md border border-border/60 bg-card p-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartPoints} margin={{ top: 12, right: 12, bottom: 8, left: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => DATE_FORMATTER.format(new Date(value))}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(value: number) => value.toFixed(4)}
                    labelFormatter={(value) => DATE_FORMATTER.format(new Date(value))}
                  />
                  <Line type="stepAfter" dataKey="rate" stroke="var(--semantic-networth)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>生效自</TableHead>
                    <TableHead>生效至</TableHead>
                    <TableHead className="text-right">汇率（1 {base}）</TableHead>
                    <TableHead>创建时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{DATE_FORMATTER.format(new Date(item.effectiveFrom))}</TableCell>
                      <TableCell>
                        {item.effectiveTo
                          ? DATE_FORMATTER.format(new Date(item.effectiveTo))
                          : "当前"}
                      </TableCell>
                      <TableCell className="text-right font-mono">{item.rate.toFixed(4)}</TableCell>
                      <TableCell>{DATE_FORMATTER.format(new Date(item.createdAt))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)} variant="outline">
            关闭
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
