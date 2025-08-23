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
    const amount = formatCurrency(Number(transaction.amount));
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

  return (
    <Card data-testid="account-operation-records">
      <CardHeader>
        <CardTitle>账户操作记录</CardTitle>

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
        {records.length === 0 ? (
          <p className="text-center text-gray-500 py-8">暂无操作记录</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3">日期</th>
                    <th className="text-left py-3">操作类型</th>
                    <th className="text-left py-3">描述</th>
                    <th className="text-left py-3">金额</th>
                    <th className="text-left py-3">备注</th>
                    <th className="text-left py-3">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-b hover:bg-gray-50">
                      <td className="py-3">{new Date(record.date).toLocaleDateString()}</td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-1 rounded text-sm ${OPERATION_TYPE_COLORS[record.type]}`}
                        >
                          {OPERATION_TYPE_LABELS[record.type]}
                        </span>
                      </td>
                      <td className="py-3">{record.description}</td>
                      <td className="py-3 font-medium">
                        <span
                          className={
                            record.type === "WITHDRAW" || record.type === "TRANSFER_OUT"
                              ? "text-red-600"
                              : "text-green-600"
                          }
                        >
                          {record.type === "WITHDRAW" || record.type === "TRANSFER_OUT" ? "-" : "+"}
                          {formatCurrency(record.amount)}
                        </span>
                      </td>
                      <td className="py-3 text-sm text-gray-600">{record.note || "-"}</td>
                      <td className="py-3">
                        {record.type === "VALUATION" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteSnapshot(record.id)}
                            className="text-red-600 hover:text-red-700"
                            data-testid="delete-snapshot-button"
                          >
                            删除
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination.totalPages > 1 && (
              <div className="flex justify-between items-center mt-6">
                <div className="text-sm text-gray-600">
                  第 {pagination.page} 页，共 {pagination.totalPages} 页 | 总计 {pagination.total}{" "}
                  条记录
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
