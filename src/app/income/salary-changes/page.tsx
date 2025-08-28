"use client";

import { SalaryChangeForm } from "@/components/modules/IncomeForms";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSalaryChanges } from "@/lib/api/income";

export default function SalaryChangesPage() {
  const { data, isLoading } = useSalaryChanges();
  const items = data?.items ?? [];
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">工资变更</h1>
      <div className="border rounded">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户</TableHead>
              <TableHead>生效日期</TableHead>
              <TableHead>税前月薪</TableHead>
              <TableHead>币种</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-sm text-muted-foreground"
                >
                  加载中…
                </TableCell>
              </TableRow>
            ) : items.length ? (
              items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{it.userId}</TableCell>
                  <TableCell>{String(it.effectiveFrom).slice(0, 10)}</TableCell>
                  <TableCell>{it.grossMonthly}</TableCell>
                  <TableCell>{it.currency}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-sm text-muted-foreground"
                >
                  暂无数据
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <SalaryChangeForm />
    </main>
  );
}
