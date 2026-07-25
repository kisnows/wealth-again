"use client";

import { useMemo, useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { chartTokens } from "@/lib/theme/palette";

type Slice = { name: string; value: number; color?: string };

type AllocPieProps = {
  data?: Slice[];
  currency?: string;
};

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

export default function AllocPie({ data = [] as Slice[], currency }: AllocPieProps) {
  const processed = useMemo(() => {
    const total = data.reduce((sum, item) => sum + Math.max(0, item.value), 0);
    if (!total) return { total, slices: [] as Array<Slice & { percentage: number; color: string }> };
    const slices = data
      .map((item, index) => {
        const value = Math.max(0, item.value);
        if (!value) return null;
        return {
          ...item,
          value,
          percentage: (value / total) * 100,
          color: item.color ?? chartTokens.allocation[index % chartTokens.allocation.length],
        };
      })
      .filter((item): item is Slice & { percentage: number; color: string } => Boolean(item));
    return { total, slices };
  }, [data]);

  const formatter = useMemo(() => createCurrencyFormatter(currency), [currency]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (!processed.total || !processed.slices.length)
    return (
      <div
        className="rounded border border-dashed p-6 text-sm text-muted-foreground"
        data-testid="reporting-ui-allocation-chart-empty"
      >
        暂无分配数据
      </div>
    );

  return (
    <div
      className="flex flex-col gap-4 rounded-md border border-border/60 bg-card/70 p-4 md:flex-row md:items-center"
      data-testid="reporting-ui-allocation-chart"
    >
      <div className="h-56 w-full md:w-1/2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              activeIndex={activeIndex ?? undefined}
              cornerRadius={8}
              cx="50%"
              cy="50%"
              data={processed.slices}
              dataKey="value"
              innerRadius={48}
              nameKey="name"
              outerRadius={80}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              paddingAngle={2}
            >
              {processed.slices.map((slice, index) => (
                <Cell
                  fill={slice.color}
                  fillOpacity={activeIndex === index ? 0.95 : 0.75}
                  key={`${slice.name}-${index}`}
                  stroke="transparent"
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0]?.payload as (Slice & {
                  percentage: number;
                  color: string;
                }) | undefined;
                if (!item) return null;
                return (
                  <div className="rounded-md border border-border/70 bg-card px-3 py-2 text-sm shadow-lg dark:bg-background/95">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm"
                        style={{ background: item.color }}
                      />
                      {item.name}
                    </div>
                    <div className="mt-1 font-medium text-foreground">
                      {formatter.format(item.value).replace(/\.00$/, "")} · {item.percentage.toFixed(1)}%
                    </div>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="grid w-full gap-2 text-sm md:w-1/2">
        {processed.slices.map((slice, index) => (
          <li className="flex items-center justify-between gap-3 rounded-md border border-border/40 px-3 py-2" key={`${slice.name}-${index}`}>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: slice.color }}
              />
              <span>{slice.name}</span>
            </div>
            <div className="text-right font-medium text-foreground">
              <div>{formatter.format(slice.value).replace(/\.00$/, "")}</div>
              <div className="text-xs text-muted-foreground">{slice.percentage.toFixed(1)}%</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
