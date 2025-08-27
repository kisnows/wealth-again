"use client";

import { useState } from "react";
import { useIncomeTimeseries } from "@/lib/api/reports";
import IncomeStackedBar from "@/components/modules/Charts/IncomeStackedBar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ReportsIncomePage() {
  const [range, setRange] = useState({ from: "2025-01-01", to: "2025-12-01", userId: "" });
  const { data, isLoading } = useIncomeTimeseries(range.userId || undefined, range.from, range.to);
  const items = (data?.series?.gross ?? []).map((g: any, i: number) => ({
    month: g.month,
    gross: Number(g.value || 0),
    bonus: Number(data?.series?.bonus?.[i]?.value || 0),
    ltcIncome: Number(data?.series?.ltcIncome?.[i]?.value || 0),
    equityIncome: Number(data?.series?.equityIncome?.[i]?.value || 0),
    socialInsurance: Number(data?.series?.socialInsurance?.[i]?.value || 0),
    housingFund: Number(data?.series?.housingFund?.[i]?.value || 0),
    incomeTax: Number(data?.series?.incomeTax?.[i]?.value || 0),
  }));
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">收入时序</h1>
      <div className="flex flex-wrap gap-2 items-center">
        <Input className="w-40" type="date" value={range.from.slice(0, 10)} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        <Input className="w-40" type="date" value={range.to.slice(0, 10)} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        <Input className="w-56" placeholder="User ID (可选)" value={range.userId} onChange={(e) => setRange({ ...range, userId: e.target.value })} />
        <Button onClick={() => { /* SWR 自动根据 key 变化刷新 */ }}>刷新</Button>
      </div>
      {isLoading ? <div className="text-sm text-muted-foreground">加载中…</div> : <IncomeStackedBar items={items} />}
    </main>
  );
}

