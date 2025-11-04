"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createFxRate,
  createFxRateUpdateTask,
  refreshFxRateNow,
  useLatestFxRates,
  type LatestFxRate,
  type RefreshFxRateResponse,
} from "@/lib/api/fx";
import { useUserPrefsStore } from "@/lib/state/identity";
import { notifyAsync } from "@/lib/utils/notify";
import {
  SUPPORTED_CURRENCY_CODES,
  formatCurrencyLabel,
} from "@/lib/domain/currency";
import FxRateHistoryDialog from "./FxRateHistoryDialog";

type AccountFxPanelProps = {
  currencies: string[];
  testId?: string;
};

const BASE_CURRENCY = "USD";

export default function AccountFxPanel({
  currencies,
  testId = "accounts-ui-fx-panel",
}: AccountFxPanelProps) {
  const [formCurrency, setFormCurrency] = useState<string>("");
  const [formRate, setFormRate] = useState<string>("");
  const [formEffectiveFrom, setFormEffectiveFrom] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [historyCurrency, setHistoryCurrency] = useState<string | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [taskCurrency, setTaskCurrency] = useState<string>("");
  const [taskStartDate, setTaskStartDate] = useState<string>("");
  const [taskEndDate, setTaskEndDate] = useState<string>("");
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [refreshingCurrency, setRefreshingCurrency] = useState<string | null>(
    null,
  );

  const supportedCurrencies = useMemo(
    () =>
      SUPPORTED_CURRENCY_CODES.filter((code) => code !== BASE_CURRENCY).map(
        (code) => code.toUpperCase(),
      ),
    [],
  );

  const effectiveCurrencies = useMemo(() => {
    const unique = new Set<string>();
    supportedCurrencies.forEach((code) => {
      unique.add(code);
    });
    currencies
      .map((code) => code.toUpperCase())
      .forEach((code) => {
        if (code && code !== BASE_CURRENCY) {
          unique.add(code);
        }
      });
    return Array.from(unique).sort();
  }, [currencies, supportedCurrencies]);

  useEffect(() => {
    if (!formCurrency && effectiveCurrencies.length > 0) {
      setFormCurrency(effectiveCurrencies[0]);
    }
    if (!taskCurrency && effectiveCurrencies.length > 0) {
      setTaskCurrency(effectiveCurrencies[0]);
    }
  }, [effectiveCurrencies, formCurrency, taskCurrency]);

  const displayCurrency = useUserPrefsStore((state) => state.displayCurrency);

  const { data, isLoading, error, mutate } =
    useLatestFxRates(effectiveCurrencies);
  const { mutate: mutateGlobal } = useSWRConfig();
  const displayCurrencyUpper = displayCurrency
    ? displayCurrency.toUpperCase()
    : null;

  const rows = useMemo(() => {
    return effectiveCurrencies.map((code) => {
      const snapshot = data?.items.find((item) => item.quote === code);
      return {
        quote: code,
        rate: snapshot?.rate ?? null,
        effectiveFrom: snapshot?.effectiveFrom ?? null,
        effectiveTo: snapshot?.effectiveTo ?? null,
      };
    });
  }, [effectiveCurrencies, data]);

  const summaryKey = displayCurrency
    ? `/api/v1/reporting/accounts/summary?displayCurrency=${displayCurrency}`
    : "/api/v1/reporting/accounts/summary";

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (
    event,
  ) => {
    event.preventDefault();
    if (!formCurrency) {
      toast.error("请选择需要更新的币种");
      return;
    }
    const rateValue = Number(formRate);
    if (!Number.isFinite(rateValue) || rateValue <= 0) {
      toast.error("请输入大于 0 的汇率");
      return;
    }
    if (!formEffectiveFrom) {
      toast.error("请选择生效开始日期");
      return;
    }
    setSubmitting(true);
    try {
      await notifyAsync(
        () =>
          createFxRate({
            base: BASE_CURRENCY,
            quote: formCurrency,
            rate: rateValue,
            effectiveFrom: new Date(formEffectiveFrom).toISOString(),
            effectiveTo: null,
          }),
        {
          loading: "正在保存汇率快照…",
          success: "汇率快照已保存",
          error: "保存失败，请稍后重试",
        },
      );
      setFormRate("");
      setFormEffectiveFrom("");
      await Promise.all([mutate(), mutateGlobal(summaryKey)]);
    } catch (err) {
      console.error("create fx rate error", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTask: React.FormEventHandler<HTMLFormElement> = async (
    event,
  ) => {
    event.preventDefault();
    if (!taskCurrency) {
      toast.error("请选择需要补齐的币种");
      return;
    }
    if (!taskStartDate || !taskEndDate) {
      toast.error("请填写起止日期");
      return;
    }
    if (taskStartDate > taskEndDate) {
      toast.error("结束日期需晚于起始日期");
      return;
    }
    setTaskSubmitting(true);
    try {
      await notifyAsync(
        () =>
          createFxRateUpdateTask({
            quote: taskCurrency,
            startDate: new Date(taskStartDate).toISOString(),
            endDate: new Date(taskEndDate).toISOString(),
          }),
        {
          loading: "正在安排周度补齐任务…",
          success: "任务已创建，系统会按周写入历史汇率",
          error: "任务创建失败，请稍后重试",
        },
      );
      setTaskStartDate("");
      setTaskEndDate("");
    } catch (error) {
      console.error("create fx update task error", error);
    } finally {
      setTaskSubmitting(false);
    }
  };

  const handleRefreshLatest = async (quote: string) => {
    setRefreshingCurrency(quote);
    try {
      const updated = await notifyAsync<RefreshFxRateResponse>(
        () => refreshFxRateNow(quote),
        {
          loading: `正在拉取 ${quote} 最新汇率…`,
          success: `${quote} 最新汇率已更新`,
          error: `${quote} 汇率更新失败，请稍后重试`,
        },
      );
      const nextItem: LatestFxRate = {
        quote: (updated?.quote ?? quote).toUpperCase(),
        rate:
          typeof updated?.rate === "number" && Number.isFinite(updated.rate)
            ? updated.rate
            : null,
        effectiveFrom: updated?.effectiveFrom ?? null,
        effectiveTo: updated?.effectiveTo ?? null,
      };
      await mutate(
        (previous) => {
          if (!previous) {
            return { base: BASE_CURRENCY, items: [nextItem] };
          }
          const existingIndex = previous.items.findIndex(
            (item) => item.quote === nextItem.quote,
          );
          const nextItems =
            existingIndex >= 0
              ? previous.items.map((item, index) =>
                  index === existingIndex ? nextItem : item,
                )
              : [...previous.items, nextItem].sort((a, b) =>
                  a.quote.localeCompare(b.quote),
                );
          return { ...previous, items: nextItems };
        },
        { revalidate: false },
      );
      await Promise.all([mutate(), mutateGlobal(summaryKey)]);
    } finally {
      setRefreshingCurrency(null);
    }
  };

  return (
    <>
      <Card data-testid={testId}>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
              汇率快照
            </CardTitle>
            <CardDescription>
              统一维护账户涉及币种的 USD 中间价，更新后自动刷新账户估值与报表。
              每次只需录入新的生效日期，系统会自动截断上一条区间，确保时间轴连续。
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">基础币种: {BASE_CURRENCY}</Badge>
            <Badge variant="secondary">
              展示币种:{" "}
              {displayCurrencyUpper
                ? formatCurrencyLabel(displayCurrencyUpper)
                : "自动（见展示偏好）"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {effectiveCurrencies.length === 0 ? (
            <div
              className="rounded-md border border-dashed p-4 text-sm text-muted-foreground"
              data-testid="accounts-ui-fx-empty"
            >
              当前账户仅使用 USD，无需维护额外汇率。
            </div>
          ) : error ? (
            <div
              className="rounded-md border border-dashed border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
              data-testid="accounts-ui-fx-error"
            >
              汇率数据加载失败，请稍后刷新或重新登录。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="accounts-ui-fx-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>币种</TableHead>
                    <TableHead>汇率（1 USD）</TableHead>
                    <TableHead>生效时间区间</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell
                        className="text-sm text-muted-foreground"
                        colSpan={5}
                      >
                        加载中…
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => {
                      const isDisplayCurrency =
                        displayCurrencyUpper === row.quote;
                      const hasRate =
                        row.rate != null && Number.isFinite(row.rate);
                      return (
                        <TableRow
                          data-testid={`accounts-ui-fx-row-${row.quote}`}
                          key={row.quote}
                        >
                          <TableCell className="font-medium text-foreground">
                            <div className="flex items-center gap-2">
                              <span>{formatCurrencyLabel(row.quote)}</span>
                              {isDisplayCurrency ? (
                                <Badge variant="secondary">展示币种</Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {hasRate ? row.rate?.toFixed(4) : "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.effectiveFrom ? (
                              <div className="flex flex-col">
                                <span>
                                  起：
                                  {new Date(
                                    row.effectiveFrom,
                                  ).toLocaleDateString("zh-CN")}
                                </span>
                                <span>
                                  止：
                                  {row.effectiveTo
                                    ? new Date(
                                        row.effectiveTo,
                                      ).toLocaleDateString("zh-CN")
                                    : "当前"}
                                </span>
                              </div>
                            ) : (
                              <span>尚未设置</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {hasRate ? (
                              <Badge variant="outline">已设置</Badge>
                            ) : (
                              <Badge
                                className="bg-amber-500/10 text-amber-600"
                                variant="secondary"
                              >
                                缺失
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                data-testid={`accounts-ui-fx-refresh-${row.quote}`}
                                disabled={refreshingCurrency === row.quote}
                                onClick={() => handleRefreshLatest(row.quote)}
                                size="sm"
                                variant="outline"
                              >
                                {refreshingCurrency === row.quote
                                  ? "更新中…"
                                  : "刷新最新"}
                              </Button>
                              <Button
                                onClick={() => {
                                  setHistoryCurrency(row.quote);
                                  setHistoryDialogOpen(true);
                                }}
                                size="sm"
                                variant="ghost"
                              >
                                查看详情
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {effectiveCurrencies.length > 0 ? (
            <form
              className="grid gap-3 md:grid-cols-[minmax(0,200px)_minmax(0,160px)_minmax(0,160px)_minmax(0,140px)]"
              data-testid="accounts-ui-fx-form"
              onSubmit={handleSubmit}
            >
              <div className="space-y-1">
                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor="fx-currency"
                >
                  币种
                </label>
                <Select onValueChange={setFormCurrency} value={formCurrency}>
                  <SelectTrigger
                    data-testid="accounts-ui-fx-select"
                    id="fx-currency"
                  >
                    <SelectValue placeholder="选择币种" />
                  </SelectTrigger>
                  <SelectContent>
                    {effectiveCurrencies.map((code) => (
                      <SelectItem key={code} value={code}>
                        {formatCurrencyLabel(code)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor="fx-rate"
                >
                  汇率（1 USD）
                </label>
                <Input
                  data-testid="accounts-ui-fx-rate"
                  id="fx-rate"
                  inputMode="decimal"
                  onChange={(event) => setFormRate(event.target.value)}
                  placeholder="0.0000"
                  step="0.0001"
                  type="number"
                  value={formRate}
                />
              </div>
              <div className="space-y-1">
                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor="fx-asof"
                >
                  生效开始
                </label>
                <Input
                  data-testid="accounts-ui-fx-date"
                  id="fx-asof"
                  onChange={(event) => setFormEffectiveFrom(event.target.value)}
                  type="date"
                  value={formEffectiveFrom}
                />
              </div>
              <div className="flex items-end">
                <Button
                  className="w-full"
                  data-testid="accounts-ui-fx-submit"
                  disabled={submitting}
                  type="submit"
                >
                  {submitting ? "保存中..." : "保存汇率"}
                </Button>
              </div>
            </form>
          ) : null}
          {effectiveCurrencies.length > 0 ? (
            <div
              className="rounded-lg border border-border/60 bg-muted/20 p-4"
              data-testid="accounts-ui-fx-task-panel"
            >
              <div className="mb-3 space-y-1">
                <p className="text-sm font-medium text-foreground">
                  周度历史补齐任务
                </p>
                <p className="text-xs text-muted-foreground">
                  按周写入一条 USD →
                  目标币种的汇率，自动衔接现有区间，确保最近一年数据连续。
                </p>
              </div>
              <form
                className="flex flex-col gap-3 md:flex-row md:items-end"
                data-testid="accounts-ui-fx-task-form"
                onSubmit={handleCreateTask}
              >
                <div className="flex flex-col gap-1 md:w-[180px]">
                  <label
                    className="text-xs font-medium text-muted-foreground"
                    htmlFor="fx-task-currency"
                  >
                    币种
                  </label>
                  <Select
                    disabled={taskSubmitting}
                    onValueChange={setTaskCurrency}
                    value={taskCurrency}
                  >
                    <SelectTrigger
                      data-testid="accounts-ui-fx-task-currency"
                      id="fx-task-currency"
                    >
                      <SelectValue placeholder="选择币种" />
                    </SelectTrigger>
                    <SelectContent>
                      {effectiveCurrencies.map((code) => (
                        <SelectItem key={code} value={code}>
                          {formatCurrencyLabel(code)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-1 flex-col gap-1 md:max-w-[220px]">
                  <label
                    className="text-xs font-medium text-muted-foreground"
                    htmlFor="fx-task-start"
                  >
                    起始日期
                  </label>
                  <Input
                    data-testid="accounts-ui-fx-task-start"
                    disabled={taskSubmitting}
                    id="fx-task-start"
                    onChange={(event) => setTaskStartDate(event.target.value)}
                    type="date"
                    value={taskStartDate}
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1 md:max-w-[220px]">
                  <label
                    className="text-xs font-medium text-muted-foreground"
                    htmlFor="fx-task-end"
                  >
                    结束日期
                  </label>
                  <Input
                    data-testid="accounts-ui-fx-task-end"
                    disabled={taskSubmitting}
                    id="fx-task-end"
                    min={taskStartDate || undefined}
                    onChange={(event) => setTaskEndDate(event.target.value)}
                    type="date"
                    value={taskEndDate}
                  />
                </div>
                <Button
                  className="md:w-auto"
                  data-testid="accounts-ui-fx-task-submit"
                  disabled={taskSubmitting}
                  type="submit"
                >
                  {taskSubmitting ? "安排中…" : "生成任务"}
                </Button>
              </form>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <FxRateHistoryDialog
        base={BASE_CURRENCY}
        onOpenChange={(open) => {
          setHistoryDialogOpen(open);
          if (!open) {
            setHistoryCurrency(null);
          }
        }}
        open={historyDialogOpen}
        quote={historyCurrency}
      />
    </>
  );
}
