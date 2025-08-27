"use client";

import { useState } from "react";
import { useIncomeRecords } from "@/lib/api/income";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function IncomeRecordsPage() {
  const [range, setRange] = useState({ from: "2025-01-01", to: "2025-12-01", userId: "" });
  const { data, isLoading } = useIncomeRecords(range.userId || undefined, range.from, range.to);
  const items = data?.items ?? [];
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">收入快照</h1>
      <div className="flex gap-2 items-center">
        <Input className="w-40" type="date" value={range.from.slice(0, 10)} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        <Input className="w-40" type="date" value={range.to.slice(0, 10)} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        <Input className="w-56" placeholder="User ID (可选)" value={range.userId} onChange={(e) => setRange({ ...range, userId: e.target.value })} />
        <Button onClick={() => { /* key 变化自动刷新 */ }}>查询</Button>
      </div>
      <div>
        <Link href="/income/recalc"><Button variant="outline" size="sm">年度回算</Button></Link>
      </div>
      {isLoading ? (
        <div className="text-sm text-muted-foreground">加载中…</div>
      ) : (
        <div className="border rounded">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>月份</TableHead>
                <TableHead>工资</TableHead>
                <TableHead>奖金</TableHead>
                <TableHead>LTC</TableHead>
                <TableHead>股权</TableHead>
                <TableHead>社保</TableHead>
                <TableHead>公积金</TableHead>
                <TableHead>个税</TableHead>
                <TableHead>税后</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{String(r.monthDate).slice(0, 10)}</TableCell>
                  <TableCell>{Number(r.gross || 0)}</TableCell>
                  <TableCell>{Number(r.bonus || 0)}</TableCell>
                  <TableCell>{Number(r.ltcIncome || 0)}</TableCell>
                  <TableCell>{Number(r.equityIncome || 0)}</TableCell>
                  <TableCell>{Number(r.socialInsurance || 0)}</TableCell>
                  <TableCell>{Number(r.housingFund || 0)}</TableCell>
                  <TableCell>{Number(r.incomeTax || 0)}</TableCell>
                  <TableCell>{Number(r.netIncome || 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  );
}
