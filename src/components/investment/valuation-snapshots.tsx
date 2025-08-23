"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

interface Snapshot {
  id: string;
  asOf: string;
  totalValue: number;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function ValuationSnapshots({ accountId }: { accountId: string }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSnapshots(1);
  }, [accountId]);

  async function fetchSnapshots(page: number) {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/accounts/${accountId}/snapshots?page=${page}&pageSize=${pagination.pageSize}`);
      const data = await response.json();
      
      if (data.success) {
        setSnapshots(data.data.map((s: any) => ({
          id: s.id,
          asOf: s.asOf,
          totalValue: Number(s.totalValue)
        })));
        setPagination(data.pagination);
      } else {
        setError(data.error?.message || "获取估值快照失败");
      }
    } catch (err) {
      console.error("Error fetching snapshots:", err);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div>加载中...</div>;
  }

  if (error) {
    return <div className="text-red-500">错误: {error}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>估值快照记录</CardTitle>
      </CardHeader>
      <CardContent>
        {snapshots.length === 0 ? (
          <p className="text-center text-gray-500 py-4">暂无估值快照记录</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">日期</th>
                    <th className="text-left py-2">账户价值</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((snapshot) => (
                    <tr key={snapshot.id} className="border-b">
                      <td className="py-2">
                        {new Date(snapshot.asOf).toLocaleDateString()}
                      </td>
                      <td className="py-2">
                        {formatCurrency(snapshot.totalValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {pagination.totalPages > 1 && (
              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-gray-600">
                  第 {pagination.page} 页，共 {pagination.totalPages} 页
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchSnapshots(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                  >
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchSnapshots(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
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