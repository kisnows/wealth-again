"use client";

import { EquityGrantForm } from "@/components/modules/IncomeForms";
import { useEquityGrants } from "@/lib/api/income";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import VestFairValueForm from "@/components/modules/VestFairValueForm";
import { Button } from "@/components/ui/button";
import { generateEquityVests } from "@/lib/api/income";
import { toast } from "sonner";

export default function EquityPage() {
  const { data, isLoading } = useEquityGrants();
  const items = data?.items ?? [];
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">股权激励</h1>
      <div className="border rounded">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户</TableHead>
              <TableHead>开始归属日</TableHead>
              <TableHead>总份额</TableHead>
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
                  <TableCell>{String(it.startVestDate).slice(0, 10)}</TableCell>
                  <TableCell>{it.totalUnits}</TableCell>
                  <TableCell>{it.vestPeriods}</TableCell>
                  <TableCell className="flex items-center gap-2">
                    <span>{it.vestInterval}</span>
                    <Button size="sm" variant="outline" onClick={async () => { await generateEquityVests(it.id); toast.success("已生成归属日程"); }}>生成归属</Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={5} className="text-sm text-muted-foreground">暂无数据</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <EquityGrantForm />
      <VestFairValueForm />
    </main>
  );
}
