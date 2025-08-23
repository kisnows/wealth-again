"use client";
import { useEffect, useState } from "react";
import IncomeSummary from "@/components/income/income-summary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export default function IncomeSummaryPage() {
  const [data, setData] = useState<any>({ records: [] });
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetch(`/api/income/summary?year=${year}`)
      .then((r) => r.json())
      .then(setData);
  }, [year]);

  const records = data.records || [];
  const cumulative = records.reduce(
    (acc: any, r: any) => {
      acc.gross += Number(r.gross || 0);
      acc.net += Number(r.net || 0);
      return acc;
    },
    { gross: 0, net: 0 },
  );

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold">收入汇总报表</h1>
      <IncomeSummary />
      <Card>
        <CardHeader>
          <CardTitle>图表预览（柱状：税前/税后；折线：累计）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-500 mb-2">简版：可替换为 recharts 图</div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">月份</th>
                  <th className="text-left py-2">税前</th>
                  <th className="text-left py-2">税后</th>
                  <th className="text-left py-2">累计税前</th>
                  <th className="text-left py-2">累计税后</th>
                </tr>
              </thead>
              <tbody>
                {records
                  .reduce((rows: any[], r: any, idx: number) => {
                    const prev = rows[idx - 1];
                    const cumGross = (prev ? prev.cumGross : 0) + Number(r.gross || 0);
                    const cumNet = (prev ? prev.cumNet : 0) + Number(r.net || 0);
                    rows.push({ month: r.month, gross: r.gross, net: r.net, cumGross, cumNet });
                    return rows;
                  }, [])
                  .map((row: any) => (
                    <tr key={row.month} className="border-b">
                      <td className="py-2">{row.month}月</td>
                      <td className="py-2">{formatCurrency(Number(row.gross || 0))}</td>
                      <td className="py-2">{formatCurrency(Number(row.net || 0))}</td>
                      <td className="py-2">{formatCurrency(row.cumGross)}</td>
                      <td className="py-2">{formatCurrency(row.cumNet)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
