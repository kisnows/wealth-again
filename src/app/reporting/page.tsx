"use client";

import { useEffect } from "react";
import { RefreshCcw, UploadCloudIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PageContainer,
  PageHeader,
  PageSection,
} from "@/components/modules/layout/PageLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useReportDatasets } from "@/lib/api/reports";
import { useUserPrefsStore } from "@/lib/state/identity";

/**
 * 报表数据集页面组件
 *
 * 展示系统生成的报表缓存记录，用于诊断报表数据是否及时生成。
 * 支持手动刷新缓存与导出报表（导出功能待实现）。
 *
 * 数据来源：
 * - useReportDatasets: 报表数据集列表
 *
 * 副作用：
 * - 加载成功后更新全局 lastDataSyncAt 时间戳
 */
export default function ReportingPage() {
  const { data, isLoading, error, mutate } = useReportDatasets();
  const { setLastDataSyncAt } = useUserPrefsStore((state) => ({
    setLastDataSyncAt: state.setLastDataSyncAt,
  }));

  useEffect(() => {
    if (!data?.items?.length) return;
    const latest = data.items[0]?.updatedAt;
    if (latest) {
      setLastDataSyncAt(latest);
    }
  }, [data?.items, setLastDataSyncAt]);

  return (
    <PageContainer
      data-testid="reporting-ui-page"
      gap="lg"
      maxWidth="xl"
      padding="md"
    >
      <PageHeader
        actions={
          <div className="flex gap-2">
            <Button
              data-testid="reporting-ui-action-refresh"
              onClick={() => mutate()}
              size="sm"
              variant="outline"
            >
              <RefreshCcw className="mr-2 h-4 w-4" /> 刷新缓存
            </Button>
            <Button
              data-testid="reporting-ui-action-export"
              disabled
              size="sm"
              variant="secondary"
            >
              <UploadCloudIcon className="mr-2 h-4 w-4" /> 导出报表
            </Button>
          </div>
        }
        description="按 scope/bucket 列出已生成的报表缓存，支持手动刷新和导出。"
        testId="reporting-ui-header"
        title="报表数据集"
      />

      <PageSection
        className="space-y-4"
        contentClassName="space-y-4"
        description="当前展示的是最新的 ReportDataset 缓存记录，可用于诊断报表数据是否及时生成。"
        testId="reporting-ui-dataset-section"
        title="缓存状态"
      >
        {error ? (
          <Card data-testid="reporting-ui-dataset-error">
            <CardHeader>
              <CardTitle>数据加载失败</CardTitle>
              <CardDescription>
                无法获取报表缓存，请刷新页面或稍后再试。
              </CardDescription>
            </CardHeader>
          </Card>
        ) : isLoading ? (
          <div className="overflow-x-auto">
            <Table data-testid="reporting-ui-dataset-loading">
              <TableHeader>
                <TableRow>
                  <TableHead>Scope</TableHead>
                  <TableHead>Bucket</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead>来源时间</TableHead>
                  <TableHead>摘要</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {["report-1", "report-2", "report-3"].map((key) => (
                  <TableRow key={key}>
                    <TableCell>
                      <Skeleton className="h-5 w-32 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-36" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-36" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-64" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : data?.items?.length ? (
          <div className="overflow-x-auto">
            <Table data-testid="reporting-ui-dataset-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Scope</TableHead>
                  <TableHead>Bucket</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead>来源时间</TableHead>
                  <TableHead>摘要</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow
                    key={item.id}
                    data-testid="reporting-ui-dataset-row"
                  >
                    <TableCell>
                      <Badge variant="outline">{item.scope}</Badge>
                    </TableCell>
                    <TableCell>{item.bucket}</TableCell>
                    <TableCell>
                      {new Date(item.updatedAt).toLocaleString("zh-CN", {
                        hour12: false,
                      })}
                    </TableCell>
                    <TableCell>
                      {item.occurredAt
                        ? new Date(item.occurredAt).toLocaleString("zh-CN", {
                            hour12: false,
                          })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <pre className="max-h-24 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                        {JSON.stringify(item.payload ?? {}, null, 2)}
                      </pre>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Card data-testid="reporting-ui-dataset-empty">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              暂无缓存记录，可前往各业务页面触发报表计算。
            </CardContent>
          </Card>
        )}
      </PageSection>
    </PageContainer>
  );
}
