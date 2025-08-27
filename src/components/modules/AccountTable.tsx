"use client";

import { useAccounts } from "@/lib/api/accounts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export function AccountTable() {
  const { data, isLoading } = useAccounts();
  const accounts = data ?? [];
  if (isLoading) return <div className="text-sm text-muted-foreground">加载中…</div>;
  return (
    <div className="border rounded">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>名称</TableHead>
            <TableHead>类型</TableHead>
            <TableHead>币种</TableHead>
            <TableHead>状态</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((acc) => (
            <TableRow key={acc.id}>
              <TableCell className="font-medium"><Link className="underline" href={`/accounts/${acc.id}`}>{acc.name}</Link></TableCell>
              <TableCell>{acc.accountType}</TableCell>
              <TableCell>{acc.baseCurrency}</TableCell>
              <TableCell>
                <Badge variant={acc.status === "ARCHIVED" ? "secondary" : "default"}>{acc.status ?? "ACTIVE"}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default AccountTable;
