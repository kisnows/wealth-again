"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chartTokens } from "@/lib/theme/palette";

type MonthValue = { month: string; [k: string]: number | string };

const SERIES_CONFIG = [
  {
    category: "income",
    color: chartTokens.incomeSeries.gross,
    key: "gross",
    label: "税前收入",
  },
  {
    category: "income",
    color: chartTokens.incomeSeries.bonus,
    key: "bonus",
    label: "奖金",
  },
  {
    category: "income",
    color: chartTokens.incomeSeries.ltcIncome,
    key: "ltcIncome",
    label: "长期现金",
  },
  {
    category: "income",
    color: chartTokens.incomeSeries.equityIncome,
    key: "equityIncome",
    label: "股权激励",
  },
  {
    category: "deduction",
    color: chartTokens.incomeSeries.socialInsurance,
    key: "socialInsurance",
    label: "社保",
  },
  {
    category: "deduction",
    color: chartTokens.incomeSeries.housingFund,
    key: "housingFund",
    label: "公积金",
  },
  {
    category: "deduction",
    color: chartTokens.incomeSeries.incomeTax,
    key: "incomeTax",
    label: "个税",
  },
] as const satisfies readonly {
  key: string;
  label: string;
  color: string;
  category: "income" | "deduction";
}[];

const createCurrencyFormatter = (currency?: string) =>
  currency
    ? new Intl.NumberFormat("zh-CN", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      })
    : new Intl.NumberFormat("zh-CN", {
        maximumFractionDigits: 0,
      });

type IncomeStackedBarProps = {
  items?: MonthValue[];
  currency?: string;
};

export default function IncomeStackedBar({
  items = [] as MonthValue[],
  currency,
}: IncomeStackedBarProps) {
  const normalized = useMemo(
    () =>
      items.map((item) => {
        const base: Record<string, number | string> = {
          month: item.month,
        };
        SERIES_CONFIG.forEach((series) => {
          const valueRaw = Number(item[series.key] ?? 0);
          const valueSafe = Number.isFinite(valueRaw) ? valueRaw : 0;
          base[series.key] = series.category === "deduction" ? -1 * valueSafe : valueSafe;
        });
        return base;
      }),
    [items],
  );

  const formatter = useMemo(() => createCurrencyFormatter(currency), [currency]);

  if (!normalized.length)
    return (
      <div
        className="rounded border border-dashed p-6 text-sm text-muted-foreground"
        data-testid="reporting-ui-income-stacked-chart-empty"
      >
        暂无时序数据
      </div>
    );

  return (
    <div
      className="rounded-md border border-border/60 bg-card/70 p-4"
      data-testid="reporting-ui-income-stacked-chart"
    >
      <ResponsiveContainer height={320} width="100%">
        <BarChart
          barCategoryGap="18%"
          barGap={2}
          data={normalized}
          margin={{ top: 12, right: 16, bottom: 8, left: 8 }}
        >
          <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" />
          <XAxis
            dataKey="month"
            tick={{ fill: "var(--semantic-neutral-text)", fontSize: 12 }}
            tickFormatter={(value: string) => value.slice(0, 7)}
            tickLine={false}
            axisLine={false}
            padding={{ left: 10, right: 10 }}
          />
          <YAxis
            tick={{ fill: "var(--semantic-neutral-text)", fontSize: 12 }}
            tickFormatter={(value: number) => formatter.format(value).replace(/\.00$/, "")}
            width={100}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "color-mix(in srgb, var(--semantic-income-total) 12%, transparent)" }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="min-w-[200px] rounded-lg border border-border/70 bg-card px-3 py-2 text-sm shadow-xl dark:bg-background/95">
                  <div className="text-xs text-muted-foreground">月份: {label}</div>
                  <ul className="mt-2 space-y-1">
                    {payload.map((entry) => {
                      const series = SERIES_CONFIG.find((item) => item.key === entry.dataKey);
                      if (!series) return null;
                      const val = Number(entry.value ?? 0);
                      if (!val) return null;
                      const displayValue = series.category === "deduction" ? Math.abs(val) : val;
                      const prefix = series.category === "deduction" ? "-" : "";
                      return (
                        <li
                          className="flex items-center justify-between gap-4"
                          key={series.key}
                        >
                          <span className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-sm"
                              style={{ background: series.color }}
                            />
                            {series.label}
                          </span>
                          <span className="font-medium text-foreground">
                            {`${prefix}${formatter
                              .format(displayValue)
                              .replace(/\.00$/, "")}`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            }}
          />
          <ReferenceLine stroke="var(--muted-foreground)" strokeDasharray="3 3" y={0} />
          <Legend
            align="right"
            iconSize={10}
            iconType="circle"
            layout="horizontal"
            verticalAlign="top"
            wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }}
            formatter={(value: string) => {
              const series = SERIES_CONFIG.find((item) => item.key === value);
              if (!series) return value;
              return series.category === "deduction" ? `${series.label}（扣除）` : series.label;
            }}
          />
          {SERIES_CONFIG.map((series) => (
            <Bar
              dataKey={series.key}
              fill={series.color}
              key={series.key}
              maxBarSize={60}
              radius={0}
              stackId={series.category === "deduction" ? "income-deduction" : "income-positive"}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
