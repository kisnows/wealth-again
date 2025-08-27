"use client";

import { BonusForm } from "@/components/modules/IncomeForms";
import { useBonus } from "@/lib/api/income";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function BonusPage() {
  const { data, isLoading } = useBonus();
  const items = data?.items ?? [];
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">一次性奖金</h1>
      <div className="border rounded">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户</TableHead>
              <TableHead>日期</TableHead>
              <TableHead>金额</TableHead>
              <TableHead>币种</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-sm text-muted-foreground">加载中…</TableCell></TableRow>
            ) : items.length ? (
              items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{it.userId}</TableCell>
                  <TableCell>{String(it.effectiveDate).slice(0, 10)}</TableCell>
                  <TableCell>{it.amount}</TableCell>
                  <TableCell>{it.currency}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={4} className="text-sm text-muted-foreground">暂无数据</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <BonusForm />
    </main>
  );
}
