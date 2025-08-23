"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CurrencyDisplay } from "@/components/shared/currency";

interface IncomeForecastChartProps {
  data: any[];
  userBaseCurrency: string;
}

/**
 * 收入预测图表组件
 */
export function IncomeForecastChart({ data, userBaseCurrency }: IncomeForecastChartProps) {
  const chartData = useMemo(() => {
    return data
      .map((item: any) => ({
        ym: item.ym || `${new Date().getFullYear()}-${String(item.month).padStart(2, "0")}`,
        taxBefore: Number(item.grossThisMonth || 0),
        taxAfter: Number(item.net || 0),
      }))
      .sort((a, b) => a.ym.localeCompare(b.ym));
  }, [data]);

  const cumulativeData = useMemo(() => {
    let cumulativeGross = 0;
    let cumulativeNet = 0;

    return chartData.map((item) => {
      cumulativeGross += item.taxBefore;
      cumulativeNet += item.taxAfter;

      return {
        ym: item.ym,
        累计税前: cumulativeGross,
        累计税后: cumulativeNet,
      };
    });
  }, [chartData]);

  const formatTooltip = (value: number) => {
    return <CurrencyDisplay amount={value} userBaseCurrency={userBaseCurrency} />;
  };

  if (data.length === 0) {
    return <div className="h-80 flex items-center justify-center text-gray-500">暂无数据</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* 月度收入对比 */}
      <div className="h-80">
        <h3 className="text-lg font-medium mb-2">月度收入对比</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="ym" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value: number) => [
                formatTooltip(value),
                value === chartData.find((d) => d.taxBefore === value)?.taxBefore
                  ? "税前收入"
                  : "税后收入",
              ]}
            />
            <Legend />
            <Bar dataKey="taxBefore" name="税前收入" fill="#8884d8" />
            <Bar dataKey="taxAfter" name="税后收入" fill="#82ca9d" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 累计收入趋势 */}
      <div className="h-80">
        <h3 className="text-lg font-medium mb-2">累计收入趋势</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={cumulativeData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="ym" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value: number, name: string) => [formatTooltip(value), name]} />
            <Legend />
            <Line
              type="monotone"
              dataKey="累计税前"
              stroke="#8884d8"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="累计税后"
              stroke="#82ca9d"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
