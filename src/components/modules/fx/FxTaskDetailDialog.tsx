"use client";

import type { ComponentProps } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type FxRateTaskDetail, useFxRateTaskDetails } from "@/lib/api/fx";

type FxTaskDetailDialogProps = {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "待执行",
  RUNNING: "执行中",
  COMPLETED: "已完成",
  FAILED: "执行失败",
  SKIPPED: "已跳过",
};

export function fxStatusVariant(status: string) {
  switch (status.toUpperCase()) {
    case "COMPLETED":
      return "default" as const;
    case "FAILED":
      return "destructive" as const;
    case "RUNNING":
      return "secondary" as const;
    case "SKIPPED":
      return "outline" as const;
    default:
      return "outline" as const;
  }
}

export default function FxTaskDetailDialog({
  taskId,
  open,
  onOpenChange,
}: FxTaskDetailDialogProps) {
  const { data, isLoading, error } = useFxRateTaskDetails(open ? taskId : null);

  const renderContent = () => {
    if (!taskId) {
      return (
        <Placeholder
          message="请选择要查看的任务"
          testId="activity-ui-fx-detail-empty"
        />
      );
    }
    if (error) {
      return (
        <Placeholder
          message="无法加载任务详情，请稍后重试。"
          testId="activity-ui-fx-detail-error"
        />
      );
    }
    if (isLoading || !data) {
      return (
        <Placeholder
          message="正在加载任务详情…"
          testId="activity-ui-fx-detail-loading"
        />
      );
    }
    return (
      <div className="flex min-h-0 flex-col gap-6 pb-2">
        <DetailSummary detail={data} />
        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
          <Table data-testid="activity-ui-fx-detail-table">
            <TableHeader>
              <TableRow>
                <TableHead>周起始</TableHead>
                <TableHead>周结束</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>最近汇率</TableHead>
                <TableHead>尝试次数</TableHead>
                <TableHead>开始时间</TableHead>
                <TableHead>完成时间</TableHead>
                <TableHead>备注</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.logs.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="text-center text-sm text-muted-foreground"
                    colSpan={8}
                  >
                    暂无拆分任务记录，稍后刷新查看。
                  </TableCell>
                </TableRow>
              ) : (
                data.logs.map((log) => (
                  <TableRow
                    key={log.id}
                    data-testid="activity-ui-fx-detail-row"
                  >
                    <TableCell>{formatDateTime(log.weekStart)}</TableCell>
                    <TableCell>{formatDateTime(log.weekEnd)}</TableCell>
                    <TableCell>
                      <Badge variant={fxStatusVariant(log.status)}>
                        {STATUS_LABEL[log.status.toUpperCase()] ?? log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {log.rate != null ? log.rate.toFixed(4) : "—"}
                    </TableCell>
                    <TableCell>{log.attempts}</TableCell>
                    <TableCell>{formatDateTime(log.startedAt)}</TableCell>
                    <TableCell>{formatDateTime(log.completedAt)}</TableCell>
                    <TableCell className="max-w-sm text-sm text-muted-foreground">
                      {log.lastError ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="flex max-h-[85vh] w-[98vw] max-w-6xl flex-col overflow-hidden sm:w-[88vw] lg:max-w-7xl lg:w-[84vw]"
        data-testid="activity-ui-fx-detail-dialog"
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>
            汇率任务详情
            {data?.quote ? ` · ${data.quote}` : ""}
          </DialogTitle>
          <DialogDescription>
            {data
              ? `区间：${formatDateTime(data.startDate)} 至 ${formatDateTime(data.endDate)}，状态：${
                  STATUS_LABEL[data.status.toUpperCase()] ?? data.status
                }`
              : "查看系统拆分的周度任务执行情况"}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-auto pr-1">{renderContent()}</div>
      </DialogContent>
    </Dialog>
  );
}

function Placeholder({ message, testId }: { message: string; testId: string }) {
  return (
    <div
      className="rounded-md border border-dashed border-border/60 bg-muted/30 p-6 text-center text-sm text-muted-foreground"
      data-testid={testId}
    >
      {message}
    </div>
  );
}

function DetailSummary({ detail }: { detail: FxRateTaskDetail }) {
  const summary = detail.summary;
  return (
    <div
      className="flex flex-wrap gap-2"
      data-testid="activity-ui-fx-detail-summary"
    >
      <SummaryBadge label="总周数" value={summary.total} />
      <SummaryBadge
        label="已完成"
        value={summary.completed}
        variant="default"
      />
      <SummaryBadge
        label="执行中"
        value={summary.running}
        variant="secondary"
      />
      <SummaryBadge label="失败" value={summary.failed} variant="destructive" />
      <SummaryBadge label="已跳过" value={summary.skipped} variant="outline" />
      <SummaryBadge label="等待中" value={summary.pending} variant="outline" />
    </div>
  );
}

function SummaryBadge({
  label,
  value,
  variant = "outline",
}: {
  label: string;
  value: number;
  variant?: ComponentProps<typeof Badge>["variant"];
}) {
  return (
    <Badge variant={variant}>
      {label}：{value}
    </Badge>
  );
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", { hour12: false });
}
