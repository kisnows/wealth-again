"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPercentage } from "@/lib/utils";

interface PerformanceData {
  date: string;
  value: number;
  pnl: number;
  twr: number;
  xirr: number;
}

export default function PerformanceChart() {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [loading, setLoading] = useState(false);

  // 获取账户列表以选择账户
  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    try {
      const res = await fetch("/api/accounts");
      const data = await res.json();
      if (data.success && data.data && data.data.length > 0) {
        setAccountId(data.data[0].id);
      }
    } catch (error) {
      console.error("Error fetching accounts:", error);
    }
  }

  // 当账户ID改变时获取绩效数据
  useEffect(() => {
    if (accountId) {
      fetchPerformanceData();
    }
  }, [accountId]);

  async function fetchPerformanceData() {
    if (!accountId) return;

    setLoading(true);
    try {
      // 获取估值快照数据用于图表
      const snapshotRes = await fetch(`/api/accounts/${accountId}/snapshots`);
      const snapshotData = await snapshotRes.json();

      // 格式化数据用于图表
      if (snapshotData.success && snapshotData.data) {
        const chartData = snapshotData.data.map((snap: any) => ({
          date: new Date(snap.asOf).toLocaleDateString(),
          value: Number(snap.totalValue),
        }));
        setPerformanceData(chartData);
      } else {
        setPerformanceData([]);
      }
    } catch (error) {
      console.error("Error fetching performance data:", error);
      setPerformanceData([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>投资账户绩效</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <p>加载中...</p>
            </div>
          ) : performanceData.length === 0 ? (
            <div className="flex justify-center items-center h-64">
              <p>暂无数据</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value))}
                      labelFormatter={(label) => `日期: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#8884d8"
                      activeDot={{ r: 8 }}
                      name="账户价值"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
