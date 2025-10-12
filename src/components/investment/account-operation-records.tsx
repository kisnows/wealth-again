"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Snapshot {
  id: string;
  asOf: string;
  totalValue: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: string;
  tradeDate: string;
  note?: string;
  currency: string;
}

interface OperationRecord {
  id: string;
  date: string;
  type: "VALUATION" | "DEPOSIT" | "WITHDRAW" | "TRANSFER_IN" | "TRANSFER_OUT";
  amount: number;
  description: string;
  note?: string;
  currency?: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const OPERATION_TYPE_LABELS = {
  VALUATION: "估值更新",
  DEPOSIT: "存款",
  WITHDRAW: "取款",
  TRANSFER_IN: "转入",
  TRANSFER_OUT: "转出",
};

const OPERATION_TYPE_COLORS = {
  VALUATION: "text-blue-600 bg-blue-50",
  DEPOSIT: "text-green-600 bg-green-50",
  WITHDRAW: "text-red-600 bg-red-50",
  TRANSFER_IN: "text-purple-600 bg-purple-50",
  TRANSFER_OUT: "text-orange-600 bg-orange-50",
};

export default function AccountOperationRecords({ accountId }: { accountId: string }) {
  const [records, setRecords] = useState<OperationRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    type: "",
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    fetchRecords(1);
  }, [accountId, filters]);

  async function fetchRecords(page: number) {
    try {
      setLoading(true);
      setError(null);

      // 并行获取快照和交易记录
      const [snapshotsResponse, transactionsResponse] = await Promise.all([
        fetch(`/api/accounts/${accountId}/snapshots?page=${page}&pageSize=${pagination.pageSize}`),
        fetch(
          `/api/transactions?accountId=${accountId}&page=${page}&pageSize=${pagination.pageSize}`,
        ),
      ]);

      const [snapshotsData, transactionsData] = await Promise.all([
        snapshotsResponse.json(),
        transactionsResponse.json(),
      ]);

      if (snapshotsData.success && transactionsData.success) {
        // 合并并转换数据
        const allRecords: OperationRecord[] = [];

        // 添加估值快照记录
        if (snapshotsData.data) {
          snapshotsData.data.forEach((snapshot: Snapshot) => {
            allRecords.push({
              id: `snapshot-${snapshot.id}`,
              date: snapshot.asOf,
              type: "VALUATION",
              amount: Number(snapshot.totalValue),
              description: `账户估值：${formatCurrency(Number(snapshot.totalValue))}`,
            });
          });
        }

        // 添加交易记录
        if (transactionsData.data) {
          transactionsData.data.forEach((transaction: Transaction) => {
            allRecords.push({
              id: `transaction-${transaction.id}`,
              date: transaction.tradeDate,
              type: transaction.type as any,
              amount: Number(transaction.amount),
              description: getTransactionDescription(transaction),
              note: transaction.note,
              currency: transaction.currency,
            });
          });
        }

        // 按日期排序（最新的在前）
        allRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // 应用筛选器
        const filteredRecords = allRecords.filter((record) => {
          if (filters.type && filters.type !== "all" && record.type !== filters.type) return false;
          if (filters.startDate && record.date < filters.startDate) return false;
          if (filters.endDate && record.date > filters.endDate) return false;
          return true;
        });

        setRecords(filteredRecords);
        setPagination({
          page,
          pageSize: pagination.pageSize,
          total: filteredRecords.length,
          totalPages: Math.ceil(filteredRecords.length / pagination.pageSize),
        });
      } else {
        setError("获取操作记录失败");
      }
    } catch (err) {
      console.error("Error fetching operation records:", err);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  function getTransactionDescription(transaction: Transaction): string {
    const amount = formatCurrency(Number(transaction.amount), transaction.currency);
    switch (transaction.type) {
      case "DEPOSIT":
        return `存款：${amount}`;
      case "WITHDRAW":
        return `取款：${amount}`;
      case "TRANSFER_IN":
        return `转入：${amount}`;
      case "TRANSFER_OUT":
        return `转出：${amount}`;
      default:
        return `${transaction.type}：${amount}`;
    }
  }

  async function handleDeleteSnapshot(snapshotId: string) {
    if (!confirm("确定要删除这个估值快照吗？")) return;

    try {
      const actualSnapshotId = snapshotId.replace("snapshot-", "");
      const response = await fetch(`/api/accounts/${accountId}/snapshots`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId: actualSnapshotId }),
      });

      const data = await response.json();
      if (data.success) {
        fetchRecords(pagination.page); // 刷新记录
      } else {
        alert(data.error?.message || "删除失败");
      }
    } catch (error) {
      console.error("Error deleting snapshot:", error);
      alert("网络错误，请稍后重试");
    }
  }

  if (loading) {
    return <div className="text-center py-8">加载中...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">错误: {error}</div>;
  }

  const handleExport = () => {
    if (records.length === 0) {
      return;
    }

    const header = ["日期", "操作类型", "金额", "币种", "备注", "描述"];
    const rows = records.map((record) => {
      const sign =
        record.type === "WITHDRAW" || record.type === "TRANSFER_OUT"
          ? "-"
          : record.type === "VALUATION"
            ? ""
            : "+";
      const formattedAmount = `${sign}${Number(record.amount).toFixed(2)}`;

      const cells = [
        new Date(record.date).toISOString().split("T")[0],
        OPERATION_TYPE_LABELS[record.type],
        formattedAmount,
        record.currency || "CNY",
        record.note || "",
        record.description,
      ];

      return cells.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",");
    });

    const csvContent = [header.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `account-records-${accountId}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const hasRecords = records.length > 0;

  return (
    <Card data-testid="account-operation-records">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>账户交易明细</CardTitle>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={!hasRecords}
            data-testid="export-transactions-button"
          >
            导出 CSV
          </Button>
        </div>

        {/* 筛选器 */}
        <div className="flex flex-wrap gap-4 mt-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="type-filter">操作类型</Label>
            <Select
              value={filters.type || "all"}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, type: value === "all" ? "" : value }))
              }
            >
              <SelectTrigger className="w-32" data-testid="type-filter">
                <SelectValue placeholder="全部类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                {Object.entries(OPERATION_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="start-date-filter">开始日期</Label>
            <Input
              id="start-date-filter"
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
              className="w-40"
              data-testid="start-date-filter"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="end-date-filter">结束日期</Label>
            <Input
              id="end-date-filter"
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
              className="w-40"
              data-testid="end-date-filter"
            />
          </div>

          <div className="flex flex-col gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setFilters({ type: "", startDate: "", endDate: "" })}
              data-testid="clear-filters-button"
            >
              清除筛选
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {!hasRecords ? (
          <p className="text-center text-gray-500 py-8">暂无操作记录</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b">
                    <TableHead className="w-[120px]">日期</TableHead>
                    <TableHead className="w-[140px]">操作类型</TableHead>
                    <TableHead>描述</TableHead>
                    <TableHead className="w-[160px]">金额</TableHead>
                    <TableHead className="w-[100px]">币种</TableHead>
                    <TableHead className="w-[180px]">备注</TableHead>
                    <TableHead className="w-[120px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => {
                    const isOutflow = record.type === "WITHDRAW" || record.type === "TRANSFER_OUT";
                    const isValuation = record.type === "VALUATION";
                    const signedAmount = isValuation
                      ? record.amount
                      : isOutflow
                        ? -record.amount
                        : record.amount;

                    return (
                      <TableRow key={record.id} className="border-b">
                        <TableCell className="py-3 text-sm">
                          {new Date(record.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="py-3">
                          <span className={`px-2 py-1 rounded text-sm ${OPERATION_TYPE_COLORS[record.type]}`}>
                            {OPERATION_TYPE_LABELS[record.type]}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 text-sm text-gray-700">{record.description}</TableCell>
                        <TableCell className="py-3 font-medium">
                          <span
                            className={
                              isValuation
                                ? "text-gray-700"
                                : isOutflow
                                  ? "text-red-600"
                                  : "text-green-600"
                            }
                          >
                            {formatCurrency(signedAmount, record.currency)}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 text-sm text-gray-600">
                          {record.currency || "-"}
                        </TableCell>
                        <TableCell className="py-3 text-sm text-gray-600">
                          {record.note || "-"}
                        </TableCell>
                        <TableCell className="py-3">
                          {record.type === "VALUATION" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteSnapshot(record.id)}
                              className="text-red-600 hover:text-red-700"
                              data-testid="delete-snapshot-button"
                            >
                              删除
                            </Button>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {pagination.totalPages > 1 && (
              <div className="flex justify-between items-center mt-6">
                <div className="text-sm text-gray-600">
                  第 {pagination.page} 页，共 {pagination.totalPages} 页 | 总计 {pagination.total} 条记录
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchRecords(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    data-testid="prev-page-button"
                  >
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchRecords(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                    data-testid="next-page-button"
                  >
                    下一页
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
