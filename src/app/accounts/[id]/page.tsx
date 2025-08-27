"use client";

import { useParams } from "next/navigation";
import { useAccountSummary, useAccountTimeseries } from "@/lib/api/accounts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/domain/money";
import TransferDialog from "@/components/modules/TransferDialog";
import ValuationFormDialog from "@/components/modules/ValuationFormDialog";
import NetWorthLine from "@/components/modules/Charts/NetWorthLine";
import DepositDialog from "@/components/modules/DepositDialog";
import WithdrawDialog from "@/components/modules/WithdrawDialog";

export default function AccountDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, isLoading } = useAccountSummary(params.id);
  const s = data;
  const { data: ts } = useAccountTimeseries(params.id, "valuation");
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">账户详情</h1>
      {isLoading || !s ? (
        <div className="text-sm text-muted-foreground">加载中…</div>
      ) : (
        <div className="grid md:grid-cols-4 gap-3">
          <Card>
            <CardHeader><CardTitle>本金</CardTitle></CardHeader>
            <CardContent className="text-lg font-semibold">{formatMoney(s.principal, s.currency)}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>估值</CardTitle></CardHeader>
            <CardContent className="text-lg font-semibold">{formatMoney(s.valuation, s.currency)}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>收益</CardTitle></CardHeader>
            <CardContent className="text-lg font-semibold">{formatMoney(s.profit, s.currency)}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>ROI</CardTitle></CardHeader>
            <CardContent className="text-lg font-semibold">{s.roi == null ? "-" : `${(s.roi * 100).toFixed(2)}%`}</CardContent>
          </Card>
        </div>
      )}
      <div className="flex gap-3">
        <TransferDialog />
        <ValuationFormDialog />
        <DepositDialog />
        <WithdrawDialog />
      </div>
      <div>
        <h2 className="text-sm text-muted-foreground mb-2">估值时间序列</h2>
        <div className="max-w-full overflow-x-auto">
          <NetWorthLine data={(ts?.points ?? []).map((p) => ({ x: String(p.asOf), y: Number(p.value) }))} />
        </div>
      </div>
    </main>
  );
}
