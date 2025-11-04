"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCcw, RepeatIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PageContainer,
  PageHeader,
  PageSection,
} from "@/components/modules/layout/PageLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type FxRateUpdateTask, useFxRateUpdateTasks } from "@/lib/api/fx";
import { type IncomeRecalcTask, useIncomeRecalcTasks } from "@/lib/api/income";
import { useTaskCenterStore } from "@/lib/state/tasks";
import FxTaskDetailDialog, {
  fxStatusVariant,
} from "@/components/modules/fx/FxTaskDetailDialog";

export default function ActivityPage() {
  const { data, isLoading, error, mutate } = useIncomeRecalcTasks({
    refreshInterval: 60_000,
  });
  const tasks = useMemo(() => data?.items ?? [], [data?.items]);
  const {
    data: fxData,
    isLoading: fxLoading,
    error: fxError,
    mutate: mutateFx,
  } = useFxRateUpdateTasks(100);
  const fxTasks = useMemo(() => fxData?.items ?? [], [fxData?.items]);
  const { setRecalcTasks } = useTaskCenterStore((state) => ({
    setRecalcTasks: state.setRecalcTasks,
  }));
  const [fxDetailTaskId, setFxDetailTaskId] = useState<string | null>(null);
  const [fxDetailOpen, setFxDetailOpen] = useState(false);

  useEffect(() => {
    setRecalcTasks(tasks);
  }, [setRecalcTasks, tasks]);

  const tabs: Array<{
    key: string;
    label: string;
    testId: string;
    badge?: number;
  }> = [
    {
      key: "recalc",
      label: "回算任务",
      testId: "activity-ui-tab-recalc",
      badge: tasks.length,
    },
    {
      key: "fx",
      label: "汇率任务",
      testId: "activity-ui-tab-fx",
      badge: fxTasks.length,
    },
    {
      key: "outbox",
      label: "EventOutbox",
      testId: "activity-ui-tab-outbox",
      badge: 0,
    },
    {
      key: "audit",
      label: "Audit Log",
      testId: "activity-ui-tab-audit",
      badge: 0,
    },
  ];

  return (
    <PageContainer
      data-testid="activity-ui-page"
      gap="lg"
      maxWidth="xl"
      padding="md"
    >
      <PageHeader
        actions={
          <div className="flex gap-2">
            <Button
              data-testid="activity-ui-action-refresh"
              onClick={() => {
                void Promise.all([mutate(), mutateFx()]);
              }}
              size="sm"
              variant="outline"
            >
              <RefreshCcw className="mr-2 h-4 w-4" /> 刷新任务
            </Button>
            <Button
              data-testid="activity-ui-action-retry"
              disabled
              size="sm"
              variant="secondary"
            >
              <RepeatIcon className="mr-2 h-4 w-4" /> 批量重试
            </Button>
          </div>
        }
        description="统一查看后台任务、事件与审计记录，后续将接入实时状态更新。"
        testId="activity-ui-header"
        title="任务中心"
      />

      <PageSection
        bleed
        className="space-y-4"
        contentClassName="p-0"
        testId="activity-ui-section"
      >
        <Tabs
          className="w-full"
          data-testid="activity-ui-tabs"
          defaultValue="recalc"
        >
          <TabsList className="w-full justify-start gap-2 overflow-x-auto">
            {tabs.map((tab) => (
              <TabsTrigger
                data-testid={tab.testId}
                key={tab.key}
                value={tab.key}
              >
                {tab.label}
                <Badge className="ml-2 hidden sm:inline-flex" variant="outline">
                  {tab.badge ?? 0}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent
            className="space-y-4 p-6"
            data-testid="activity-ui-tabpanel-recalc"
            value="recalc"
          >
            {error ? (
              <PlaceholderCard
                description="无法获取回算任务，请稍后刷新重试。"
                testId="activity-ui-recalc-error"
                title="加载失败"
              />
            ) : isLoading ? (
              <PlaceholderCard
                description="正在加载回算任务…"
                testId="activity-ui-recalc-loading"
                title="加载中"
              />
            ) : tasks.length ? (
              <div className="overflow-x-auto">
                <Table data-testid="activity-ui-recalc-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>税年</TableHead>
                      <TableHead>月份范围</TableHead>
                      <TableHead>城市</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>计划执行</TableHead>
                      <TableHead>完成时间</TableHead>
                      <TableHead>尝试</TableHead>
                      <TableHead>备注</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task) => (
                      <TableRow
                        key={task.id}
                        data-testid="activity-ui-recalc-row"
                      >
                        <TableCell>{task.taxYear}</TableCell>
                        <TableCell>
                          {formatMonthRange(task.startMonth, task.endMonth)}
                        </TableCell>
                        <TableCell>{task.cityId ?? "默认"}</TableCell>
                        <TableCell>
                          <Badge variant={recalcStatusVariant(task.status)}>
                            {task.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(task.scheduledFor)}</TableCell>
                        <TableCell>{formatDate(task.processedAt)}</TableCell>
                        <TableCell>{task.attempts}</TableCell>
                        <TableCell className="max-w-xs text-sm text-muted-foreground">
                          {task.lastError ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <PlaceholderCard
                description="暂无任务，请在收入页面触发回算或等待系统自动执行。"
                testId="activity-ui-recalc-empty"
                title="暂无任务"
              />
            )}
          </TabsContent>
          <TabsContent
            className="space-y-4 p-6"
            data-testid="activity-ui-tabpanel-fx"
            value="fx"
          >
            {fxError ? (
              <PlaceholderCard
                description="无法获取汇率任务，请稍后刷新重试。"
                testId="activity-ui-fx-error"
                title="加载失败"
              />
            ) : fxLoading ? (
              <PlaceholderCard
                description="正在加载汇率任务…"
                testId="activity-ui-fx-loading"
                title="加载中"
              />
            ) : fxTasks.length ? (
              <div className="overflow-x-auto">
                <Table data-testid="activity-ui-fx-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>币种</TableHead>
                      <TableHead>区间</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>计划执行</TableHead>
                      <TableHead>完成时间</TableHead>
                      <TableHead>尝试</TableHead>
                      <TableHead>触发来源</TableHead>
                      <TableHead>错误信息</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fxTasks.map((task) => (
                      <TableRow key={task.id} data-testid="activity-ui-fx-row">
                        <TableCell>{task.quote}</TableCell>
                        <TableCell>
                          <div className="flex flex-col text-xs">
                            <span>起：{formatDate(task.startDate)}</span>
                            <span>止：{formatDate(task.endDate)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={fxStatusVariant(task.status)}>
                            {task.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(task.scheduledFor)}</TableCell>
                        <TableCell>{formatDate(task.processedAt)}</TableCell>
                        <TableCell>{task.attempts}</TableCell>
                        <TableCell>{task.triggeredBy ?? "system"}</TableCell>
                        <TableCell className="max-w-xs text-sm text-muted-foreground">
                          {task.lastError ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            data-testid="activity-ui-fx-detail"
                            onClick={() => {
                              setFxDetailTaskId(task.id);
                              setFxDetailOpen(true);
                            }}
                            size="sm"
                            variant="ghost"
                          >
                            查看详情
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <PlaceholderCard
                description="暂无汇率任务，可在设置页安排历史补齐或等待系统自动调度。"
                testId="activity-ui-fx-empty"
                title="暂无任务"
              />
            )}
          </TabsContent>
          <TabsContent
            className="space-y-4 p-6"
            data-testid="activity-ui-tabpanel-outbox"
            value="outbox"
          >
            <PlaceholderCard
              description="用于展示 EventOutbox 事件，支持搜索与分组。"
              testId="activity-ui-outbox-placeholder"
              title="EventOutbox"
            />
          </TabsContent>
          <TabsContent
            className="space-y-4 p-6"
            data-testid="activity-ui-tabpanel-audit"
            value="audit"
          >
            <PlaceholderCard
              description="审计日志时间线将在后续接入，展示敏感操作记录。"
              testId="activity-ui-audit-placeholder"
              title="Audit Log"
            />
          </TabsContent>
        </Tabs>
      </PageSection>
      <FxTaskDetailDialog
        onOpenChange={(open) => {
          setFxDetailOpen(open);
          if (!open) {
            setFxDetailTaskId(null);
          }
        }}
        open={fxDetailOpen}
        taskId={fxDetailTaskId}
      />
    </PageContainer>
  );
}

type PlaceholderCardProps = {
  title: string;
  description: string;
  testId: string;
};

function PlaceholderCard({ title, description, testId }: PlaceholderCardProps) {
  return (
    <div
      className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-6 text-sm text-muted-foreground"
      data-testid={testId}
    >
      <div className="text-base font-medium text-foreground">{title}</div>
      <p className="mt-2 leading-relaxed">{description}</p>
    </div>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", { hour12: false });
}

function formatMonthRange(start: number, end: number) {
  if (start === end) return `${start} 月`;
  return `${start} - ${end} 月`;
}

function recalcStatusVariant(status: IncomeRecalcTask["status"]) {
  switch (status) {
    case "COMPLETED":
      return "default" as const;
    case "FAILED":
      return "destructive" as const;
    case "RUNNING":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}
