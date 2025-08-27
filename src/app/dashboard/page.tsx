"use client";

import { useAccountsSummary, useDashboard } from "@/lib/api/reports";
import { useUserPrefsStore } from "@/lib/state/user-prefs";
import { formatMoney } from "@/lib/domain/money";
import NetWorthLine from "@/components/modules/Charts/NetWorthLine";
import AllocPie from "@/components/modules/Charts/AllocPie";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import TopAccounts from "@/components/modules/TopAccounts";

export default function DashboardPage() {
  const { displayCurrency, asOfDate } = useUserPrefsStore();
  const { data, isLoading } = useDashboard(asOfDate ?? undefined, displayCurrency ?? undefined);
  const { data: sum } = useAccountsSummary(displayCurrency ?? undefined);
  const totals = data?.totals ?? { assets: 0, liabilities: 0, netWorth: 0 };
  const allocEntries = Object.entries(
    (sum?.items ?? []).reduce((acc: Record<string, number>, it: any) => {
      const key = (it as any).accountType ?? "OTHER";
      const v = Number((it as any).displayValue ?? (it as any).valuation ?? 0);
      acc[key] = (acc[key] ?? 0) + v;
      return acc;
    }, {} as Record<string, number>),
  ).map(([name, value]) => ({ name, value }));

  return (
    <main className="p-6 space-y-3">
      <h1 className="text-xl font-bold">Dashboard</h1>
      <div className="flex gap-2 items-center">
        <Input className="w-40" placeholder="展示币种，如 CNY" value={displayCurrency ?? ""} onChange={(e) => useUserPrefsStore.getState().setDisplayCurrency(e.target.value || null)} />
        <Input className="w-40" placeholder="统计日期 YYYY-MM-DD" value={asOfDate ?? ""} onChange={(e) => useUserPrefsStore.getState().setAsOfDate(e.target.value || null)} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader><CardTitle>总资产</CardTitle></CardHeader>
          <CardContent className="text-lg font-semibold">{formatMoney(totals.assets, displayCurrency ?? "CNY")}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>总负债</CardTitle></CardHeader>
          <CardContent className="text-lg font-semibold">{formatMoney(totals.liabilities, displayCurrency ?? "CNY")}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>净资产</CardTitle></CardHeader>
          <CardContent className="text-lg font-semibold">{formatMoney(totals.netWorth, displayCurrency ?? "CNY")}</CardContent>
        </Card>
      </div>
      {isLoading && <div className="text-sm text-muted-foreground">加载中…</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <h2 className="text-sm text-muted-foreground mb-2">净资产趋势</h2>
          <NetWorthLine data={[]} />
        </div>
        <div>
          <h2 className="text-sm text-muted-foreground mb-2">资产占比</h2>
          <AllocPie data={allocEntries} />
        </div>
      </div>
      <TopAccounts />
    </main>
  );
}
