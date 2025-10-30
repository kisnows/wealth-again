"use client";

import {
  AlertCircleIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  Clock4Icon,
  HistoryIcon,
  Loader2Icon,
  RefreshCcwIcon,
  XCircleIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { mutate as globalMutate } from "swr";
import CitySelect from "@/components/modules/CitySelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  INCOME_RECALC_TASKS_KEY,
  type IncomeRecalcTask,
  postIncomeRecalc,
  useIncomeRecalcTasks,
} from "@/lib/api/income";
import { cn } from "@/lib/utils";
import { useIncomeStore } from "@/lib/state/income";
import { toast } from "sonner";

const TASK_STATUS_ICON: Record<
  IncomeRecalcTask["status"],
  { icon: React.ComponentType<any>; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING: { icon: Clock4Icon, variant: "secondary" },
  RUNNING: { icon: Loader2Icon, variant: "outline" },
  COMPLETED: { icon: CheckCircle2Icon, variant: "default" },
  FAILED: { icon: XCircleIcon, variant: "destructive" },
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatMonthRange(start: number, end: number) {
  if (start === end) return `${start} 月`;
  return `${start} - ${end} 月`;
}

export function IncomeRecalcTaskBoard() {
  const { data, isLoading, error, mutate } = useIncomeRecalcTasks({
    refreshInterval: 60_000,
  });

  const tasks = data?.items ?? [];

  return (
    <div
      className="grid gap-6 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)]"
      data-testid="income-ui-recalc-board"
    >
      <Card data-testid="income-ui-recalc-tasks">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <HistoryIcon className="h-5 w-5 text-primary" />
              回算任务队列
            </CardTitle>
            <CardDescription>
              影响收入的变更会自动汇总成任务，统一在后台回算。
            </CardDescription>
          </div>
          <Button
            data-testid="income-ui-recalc-refresh"
            onClick={() => mutate()}
            size="sm"
            variant="outline"
          >
            <RefreshCcwIcon className="mr-2 h-4 w-4" />
            刷新
          </Button>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              <AlertCircleIcon className="h-5 w-5" />
              任务列表加载失败，请稍后重试。
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2Icon className="h-4 w-4 animate-spin" />
              加载中…
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-muted-foreground">
              <CheckCircle2Icon className="h-8 w-8 text-primary" />
              <p>暂无待处理任务，所有收入记录均已最新。</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>税年</TableHead>
                    <TableHead>月份范围</TableHead>
                    <TableHead>城市</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>计划执行时间</TableHead>
                    <TableHead>完成时间</TableHead>
                    <TableHead>尝试次数</TableHead>
                    <TableHead>备注</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => {
                    const statusMeta = TASK_STATUS_ICON[task.status];
                    const StatusIcon = statusMeta.icon;
                    return (
                      <TableRow key={task.id}>
                        <TableCell className="font-mono text-sm text-foreground">
                          {task.taxYear}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {formatMonthRange(task.startMonth, task.endMonth)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {task.cityId ?? "默认城市"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className="flex items-center gap-1"
                            variant={statusMeta.variant}
                          >
                            <StatusIcon
                              className={cn(
                                "h-3.5 w-3.5",
                                task.status === "RUNNING" ? "animate-spin" : undefined,
                              )}
                            />
                            {task.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-mono">
                          {formatDateTime(task.scheduledFor)}
                        </TableCell>
                        <TableCell className="text-sm font-mono">
                          {formatDateTime(task.processedAt)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {task.attempts}
                        </TableCell>
                        <TableCell className="max-w-xs text-sm text-muted-foreground">
                          {task.lastError ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <IncomeRecalcManualForm />
    </div>
  );
}

function IncomeRecalcManualForm() {
  const today = useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const defaultEndMonth = today.getMonth() + 1;
  const [form, setForm] = useState({
    taxYear: `${currentYear}`,
    endMonth: String(defaultEndMonth).padStart(2, "0"),
    cityId: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const notifyRecalc = useIncomeStore((state) => state.notifyRecalc);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const taxYearNumber = Number(form.taxYear);
    const endMonthNumber = Number(form.endMonth);
    if (
      Number.isNaN(taxYearNumber) ||
      taxYearNumber < 2000 ||
      Number.isNaN(endMonthNumber) ||
      endMonthNumber < 1 ||
      endMonthNumber > 12
    ) {
      toast.error("请填写有效的税年与截止月份");
      return;
    }
    setSubmitting(true);
    try {
      const result = await postIncomeRecalc({
        taxYear: taxYearNumber,
        endMonth: endMonthNumber,
        cityId: form.cityId || undefined,
      });
      const taskIdentifier = typeof result?.taskId === "string" ? result.taskId : "--";
      toast.success(`回算任务已入队（任务号 ${taskIdentifier}）`);
      notifyRecalc();
      await globalMutate(INCOME_RECALC_TASKS_KEY);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "回算失败，请稍后再试";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card data-testid="income-ui-recalc-manual">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <CalendarClockIcon className="h-5 w-5 text-primary" />
          立即回算
        </CardTitle>
        <CardDescription>
          提交后任务会排入后台队列，请在右侧任务列表关注进度或等待 worker 完成处理。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                税年
              </label>
              <Input
                data-testid="income-ui-recalc-year"
                min="2000"
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, taxYear: event.target.value }))
                }
                type="number"
                value={form.taxYear}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                截止月份
              </label>
              <Input
                data-testid="income-ui-recalc-month"
                max="12"
                min="1"
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, endMonth: event.target.value }))
                }
                type="number"
                value={form.endMonth}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                指定城市（可选）
              </label>
              <CitySelect
                className="w-full"
                data-testid="income-ui-recalc-city"
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, cityId: value }))
                }
                placeholder="未选择则使用当前城市"
                value={form.cityId || undefined}
              />
              {form.cityId ? (
                <Button
                  className="mt-2 w-full"
                  onClick={() => setForm((prev) => ({ ...prev, cityId: "" }))}
                  type="button"
                  variant="ghost"
                >
                  清除城市
                </Button>
              ) : null}
            </div>
          </div>
          <div className="rounded-md border border-dashed border-border/70 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
            <p className="flex items-center gap-2">
              <Clock4Icon className="h-4 w-4" />
              系统持续监听变更并自动排队，手动触发仅在需要手动扩展范围时使用。
            </p>
            <p className="mt-2 flex items-center gap-2">
              <HistoryIcon className="h-4 w-4" />
              本地调试请在终端运行
              <code className="rounded-sm bg-background px-1 py-0.5 font-mono text-[11px]">
                npm run worker
              </code>
              以便及时消费任务。
            </p>
          </div>
          <Button
            className="w-full"
            data-testid="income-ui-recalc-submit"
            disabled={submitting}
            type="submit"
          >
            {submitting ? (
              <>
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                回算中…
              </>
            ) : (
              "立即回算"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
