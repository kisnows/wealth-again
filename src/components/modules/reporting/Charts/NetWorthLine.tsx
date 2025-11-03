"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chartTokens } from "@/lib/theme/palette";

type Point = { x: string; y: number };

type NetWorthLineProps = {
  data?: Point[];
  currency?: string;
};

const defaultFormatter = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 0,
});

const createCurrencyFormatter = (currency?: string) =>
  currency
    ? new Intl.NumberFormat("zh-CN", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      })
    : defaultFormatter;

export default function NetWorthLine({
  data = [] as Point[],
  currency,
}: NetWorthLineProps) {
  const formatter = useMemo(() => createCurrencyFormatter(currency), [currency]);
  const lineColor = chartTokens.netWorth;
  const formatValue = (value: number) => formatter.format(value).replace(/\.00$/, "");

  if (!data.length)
    return (
      <div
        className="rounded border border-dashed p-6 text-sm text-muted-foreground"
        data-testid="reporting-ui-networth-chart-empty"
      >
        暂无数据
      </div>
    );

  return (
    <div
      className="rounded-md border border-border/60 bg-card/70 p-4"
      data-testid="reporting-ui-networth-chart"
    >
      <ResponsiveContainer height={260} width="100%">
        <LineChart data={data} margin={{ top: 12, right: 8, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="x"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            tickFormatter={(value: string) => value.slice(0, 7)}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            padding={{ left: 6, right: 6 }}
          />
          <YAxis
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            tickFormatter={formatValue}
            width={80}
            tickMargin={8}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ stroke: lineColor, strokeWidth: 1, strokeDasharray: "4 2" }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0];
              return (
                <div className="rounded-md border border-border/70 bg-card px-3 py-2 shadow-lg dark:bg-background/95">
                  <div className="text-xs text-muted-foreground">月份: {label}</div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    净资产 {formatValue(Number(point.value))}
                  </div>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="y"
            name="净资产"
            stroke={lineColor}
            strokeWidth={2.8}
            dot={{ r: 3.6, stroke: lineColor, strokeWidth: 1, fill: "#fff" }}
            activeDot={{ r: 6, stroke: lineColor, strokeWidth: 1.2, fill: "#fff" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
