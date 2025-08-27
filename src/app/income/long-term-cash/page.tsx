"use client";

import { LTCPlanForm } from "@/components/modules/IncomeForms";
import { useLTCPlans } from "@/lib/api/income";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { generateLTCPayouts } from "@/lib/api/income";
import { toast } from "sonner";

export default function LongTermCashPage() {
  const { data, isLoading } = useLTCPlans();
  const items = data?.items ?? [];
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">长期现金</h1>
      <div className="border rounded">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户</TableHead>
              <TableHead>开始日期</TableHead>
              <TableHead>总金额</TableHead>
              <TableHead>期数</TableHead>
              <TableHead>频率</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-sm text-muted-foreground">加载中…</TableCell></TableRow>
            ) : items.length ? (
              items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{it.userId}</TableCell>
                  <TableCell>{String(it.startDate).slice(0, 10)}</TableCell>
                  <TableCell>{it.totalAmount}</TableCell>
                  <TableCell>{it.periods}</TableCell>
                  <TableCell className="flex items-center gap-2">
                    <span>{it.recurrence}</span>
                    <Button size="sm" variant="outline" onClick={async () => { await generateLTCPayouts(it.id); toast.success("已生成发放日程"); }}>生成日程</Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={5} className="text-sm text-muted-foreground">暂无数据</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <LTCPlanForm />
    </main>
  );
}
