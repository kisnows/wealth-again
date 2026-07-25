"use client";

import {
  BarChart3Icon,
  CalendarIcon,
  DollarSignIcon,
  PercentIcon,
  TrendingUpIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import IncomeStackedBar from "@/components/modules/reporting/Charts/IncomeStackedBar";
import { MetricCard } from "@/components/modules/reporting/MetricCard";
import { StateCard } from "@/components/modules/common/StateCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIncomeTimeline } from "@/lib/api/income";
import type {
  IncomeTimelineItem,
  IncomeTimelineSummary,
} from "@/lib/api/income";
import { formatMoney } from "@/lib/domain/money";
import { useUserPrefsStore } from "@/lib/state/identity";
import { cn } from "@/lib/utils";
import { notifyAsync } from "@/lib/utils/notify";
import { updateIncomeRecord } from "@/lib/api/income";
import { Textarea } from "@/components/ui/textarea";
import { accentTokens, semanticAccents } from "@/lib/theme/palette";

type Props = {
  testIdPrefix: string;
  defaultFrom?: string;
  defaultTo?: string;
  title?: string;
  description?: string;
  showHeaderBadge?: boolean;
};

const monthLabel = (value: string) => value.slice(0, 7);

export default function IncomeAnalyticsPanel({
  testIdPrefix,
  defaultFrom,
  defaultTo,
  title = "收入总览",
  description = "跨越历史与预测的统一视图，所有数据来自服务端计算。",
  showHeaderBadge = false,
}: Props) {
  const currentYear = new Date().getFullYear();
  const [range, setRange] = useState(() => ({
    from: defaultFrom ?? `${currentYear}-01-01`,
    to: defaultTo ?? `${currentYear}-12-01`,
  }));
  const { displayCurrency } = useUserPrefsStore();
  const { data, error, isLoading, mutate } = useIncomeTimeline(
    range.from,
    range.to,
    displayCurrency ?? undefined,
  );
  const [editingItem, setEditingItem] = useState<IncomeTimelineItem | null>(
    null,
  );
  const [manualNetInput, setManualNetInput] = useState("");
  const [manualNoteInput, setManualNoteInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const processed = useMemo(() => {
    if (!data) {
      return {
        items: [] as IncomeTimelineItem[],
        chartItems: [] as Array<Record<string, number | string>>,
        summary: null as IncomeTimelineSummary | null,
        currency: displayCurrency ?? "CNY",
      };
    }
    const currency =
      data.summary.currency ??
      displayCurrency ??
      data.items[0]?.currency ??
      "CNY";
    const chartItems = data.items.map((item) => ({
      month: monthLabel(item.month),
      gross: item.gross,
      bonus: item.bonus,
      ltcIncome: item.ltcIncome,
      equityIncome: item.equityIncome,
      socialInsurance: item.socialInsurance,
      housingFund: item.housingFund,
      incomeTax: item.incomeTax,
    }));
    return {
      items: data.items,
      chartItems,
      summary: data.summary,
      currency,
    };
  }, [data, displayCurrency]);

  const totalsCombined = useMemo(() => {
    const summary = processed.summary;
    if (!summary) {
      return {
        totalIncome: 0,
        totalNet: 0,
        totalDeductions: 0,
        effectiveTaxRate: 0,
        actualNet: 0,
        forecastNet: 0,
        actualIncome: 0,
        forecastIncome: 0,
        counts: { total: 0, actual: 0, forecast: 0 },
      };
    }
    const combined = summary.totals.combined;
    const totalIncome =
      combined.gross +
      combined.bonus +
      combined.ltcIncome +
      combined.equityIncome;
    const totalDeductions =
      combined.socialInsurance + combined.housingFund + combined.incomeTax;
    const totalNet = combined.netIncome;
    const effectiveTaxRate =
      totalIncome > 0 ? (combined.incomeTax / totalIncome) * 100 : 0;
    const actual = summary.totals.actual;
    const forecast = summary.totals.forecast;
    const actualIncome =
      actual.gross + actual.bonus + actual.ltcIncome + actual.equityIncome;
    const forecastIncome =
      forecast.gross +
      forecast.bonus +
      forecast.ltcIncome +
      forecast.equityIncome;
    return {
      totalIncome,
      totalNet,
      totalDeductions,
      effectiveTaxRate,
      actualNet: summary.totals.actual.netIncome,
      forecastNet: summary.totals.forecast.netIncome,
      actualIncome,
      forecastIncome,
      counts: summary.counts,
    };
  }, [processed.summary]);

  const setRangePart = (key: "from" | "to", value: string) => {
    setRange((prev) => ({ ...prev, [key]: value }));
  };

  const openEdit = (item: IncomeTimelineItem) => {
    setEditingItem(item);
    setManualNetInput(
      Number.isFinite(item.netIncome) ? String(item.netIncome) : "",
    );
    setManualNoteInput(item.manualNote ?? "");
  };

  const closeEdit = () => {
    if (submitting) return;
    setEditingItem(null);
    setManualNetInput("");
    setManualNoteInput("");
  };

  const handleSave = async () => {
    if (!editingItem?.recordId) return;
    const value = Number(manualNetInput);
    if (Number.isNaN(value)) {
      toast.error("请填写有效的税后净收入");
      return;
    }
    setSubmitting(true);
    try {
      await notifyAsync(
        () =>
          updateIncomeRecord(editingItem.recordId, {
            manualNet: value,
            manualNote: manualNoteInput.trim() || null,
          }),
        {
          loading: "正在保存调整…",
          success: "人工调整已保存",
          error: (error_) =>
            error_ instanceof Error && error_.message
              ? error_.message
              : "保存失败，请稍后再试",
        },
      );
      await mutate();
      closeEdit();
    } catch (error) {
      console.error("manual override error", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (!editingItem?.recordId) return;
    setSubmitting(true);
    try {
      await notifyAsync(
        () =>
          updateIncomeRecord(editingItem.recordId, {
            manualNet: null,
            manualNote: manualNoteInput.trim() || null,
          }),
        {
          loading: "正在恢复系统计算…",
          success: "已恢复系统计算",
          error: (error_) =>
            error_ instanceof Error && error_.message
              ? error_.message
              : "操作失败，请稍后再试",
        },
      );
      await mutate();
      closeEdit();
    } catch (error) {
      console.error("reset manual override error", error);
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <StateCard
        variant="error"
        description="收入数据加载失败，请稍后重试。"
        testId={`${testIdPrefix}-analytics-error`}
      />
    );
  }

  return (
    <div className="space-y-6" data-testid={`${testIdPrefix}-analytics-panel`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {showHeaderBadge ? (
          <Badge variant="outline">数据源：IncomeTimeline</Badge>
        ) : null}
      </div>

      <Card data-testid={`${testIdPrefix}-analytics-range`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarIcon
              className={cn("h-5 w-5", accentTokens.primary.text)}
            />
            统计区间
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            选择需要分析的月份范围，历史与预测会自动合并。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-[repeat(3,minmax(0,220px))]">
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">
                开始日期
              </span>
              <Input
                data-testid={`${testIdPrefix}-analytics-from`}
                onChange={(event) => setRangePart("from", event.target.value)}
                type="date"
                value={range.from}
              />
            </div>
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">
                结束日期
              </span>
              <Input
                data-testid={`${testIdPrefix}-analytics-to`}
                onChange={(event) => setRangePart("to", event.target.value)}
                type="date"
                value={range.to}
              />
            </div>
            <div className="flex items-end justify-end gap-2">
              <Button
                data-testid={`${testIdPrefix}-analytics-reset-year`}
                onClick={() =>
                  setRange({
                    from: `${currentYear}-01-01`,
                    to: `${currentYear}-12-01`,
                  })
                }
                size="sm"
                type="button"
                variant="outline"
              >
                当年全年
              </Button>
              <Button
                data-testid={`${testIdPrefix}-analytics-reset-ytd`}
                onClick={() =>
                  setRange({
                    from: `${currentYear}-01-01`,
                    to: new Date().toISOString().slice(0, 10),
                  })
                }
                size="sm"
                type="button"
                variant="outline"
              >
                年初至今
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card data-testid={`${testIdPrefix}-analytics-loading`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-32" />
            </CardTitle>
            <CardDescription>
              <Skeleton className="h-4 w-64" />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {["summary-1", "summary-2", "summary-3", "summary-4"].map(
                (key) => (
                  <div
                    key={key}
                    className="space-y-2 rounded-lg border border-border/60 bg-card/80 p-4 shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <Skeleton className="h-7 w-32" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                ),
              )}
            </div>
          </CardContent>
        </Card>
      ) : processed.items.length === 0 ? (
        <StateCard
          variant="empty"
          description="当前区间暂无收入记录或预测数据。"
          testId={`${testIdPrefix}-analytics-empty`}
        />
      ) : (
        <>
          <Card data-testid={`${testIdPrefix}-analytics-summary`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSignIcon
                  className={cn("h-5 w-5", accentTokens.primary.text)}
                />
                汇总指标（{processed.currency}）
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                结合实际 {totalsCombined.counts.actual} 个月与预测{" "}
                {totalsCombined.counts.forecast} 个月的数据。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  accent={semanticAccents.income.total}
                  icon={DollarSignIcon}
                  title="总收入"
                  testId={`${testIdPrefix}-analytics-total-income`}
                  value={formatMoney(
                    totalsCombined.totalIncome,
                    processed.currency,
                  )}
                  hint={`实际 ${formatMoney(
                    totalsCombined.actualIncome,
                    processed.currency,
                  )} · 预测 ${formatMoney(
                    totalsCombined.forecastIncome,
                    processed.currency,
                  )}`}
                  variant="compact"
                  showTopBorder={false}
                />
                <MetricCard
                  accent={semanticAccents.income.net}
                  icon={TrendingUpIcon}
                  title="净收入"
                  testId={`${testIdPrefix}-analytics-total-net`}
                  value={formatMoney(
                    totalsCombined.totalNet,
                    processed.currency,
                  )}
                  hint={`实际 ${formatMoney(
                    totalsCombined.actualNet,
                    processed.currency,
                  )} · 预测 ${formatMoney(
                    totalsCombined.forecastNet,
                    processed.currency,
                  )}`}
                  variant="compact"
                  showTopBorder={false}
                />
                <MetricCard
                  accent={semanticAccents.income.deductions}
                  icon={BarChart3Icon}
                  title="总扣除"
                  testId={`${testIdPrefix}-analytics-total-deduction`}
                  value={formatMoney(
                    totalsCombined.totalDeductions,
                    processed.currency,
                  )}
                  hint={`含社保、公积金及个税`}
                  variant="compact"
                  showTopBorder={false}
                />
                <MetricCard
                  accent={semanticAccents.income.taxRate}
                  icon={PercentIcon}
                  title="有效税率"
                  testId={`${testIdPrefix}-analytics-effective-tax`}
                  value={`${totalsCombined.effectiveTaxRate.toFixed(1)}%`}
                  hint={`实际月数 ${totalsCombined.counts.actual} | 预测月数 ${totalsCombined.counts.forecast}`}
                  variant="compact"
                  showTopBorder={false}
                />
              </div>
            </CardContent>
          </Card>

          <Card data-testid={`${testIdPrefix}-analytics-chart`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3Icon
                  className={cn("h-5 w-5", accentTokens.primary.text)}
                />
                月度结构
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                同一张图展示历史与未来月份的收入构成。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IncomeStackedBar
                currency={processed.currency}
                items={processed.chartItems}
              />
            </CardContent>
          </Card>

          <Card data-testid={`${testIdPrefix}-analytics-table`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSignIcon
                  className={cn("h-5 w-5", accentTokens.primary.text)}
                />
                月度明细
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                所有字段直接来源于服务端回算结果，对账字段与预测保持一致。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>月份</TableHead>
                      <TableHead className="text-right">税前收入</TableHead>
                      <TableHead className="text-right">奖金</TableHead>
                      <TableHead className="text-right">长期现金</TableHead>
                      <TableHead className="text-right">股权激励</TableHead>
                      <TableHead className="text-right">社保</TableHead>
                      <TableHead className="text-right">公积金</TableHead>
                      <TableHead className="text-right">个税</TableHead>
                      <TableHead className="text-right">当期应税</TableHead>
                      <TableHead className="text-right">累计应税</TableHead>
                      <TableHead className="text-right">累计应纳税额</TableHead>
                      <TableHead className="text-right">累计已预扣</TableHead>
                      <TableHead className="text-right">税后净收</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processed.items.map((item) => {
                      const originalCurrency =
                        item.sourceCurrency && item.sourceCurrency.length > 0
                          ? item.sourceCurrency
                          : item.recordCurrency;
                      const recordCurrency = item.recordCurrency;
                      const displayCurrency =
                        item.displayCurrency ?? processed.currency;
                      const formatRate = (value: number) => {
                        if (!Number.isFinite(value) || value === 0) return "-";
                        if (value >= 100) return value.toFixed(2);
                        if (value >= 1) return value.toFixed(4);
                        return value.toFixed(6);
                      };
                      const formatDate = (value: string | null) => {
                        if (!value) return null;
                        const date = new Date(value);
                        if (Number.isNaN(date.getTime())) return null;
                        return date.toISOString().slice(0, 10);
                      };
                      const detailLines: string[] = [];
                      if (
                        originalCurrency &&
                        originalCurrency !== recordCurrency
                      ) {
                        const parts = [
                          `原币 ${originalCurrency} → 计算 ${recordCurrency}`,
                        ];
                        if (
                          item.fxAppliedRate &&
                          Math.abs(item.fxAppliedRate - 1) > 1e-6
                        ) {
                          parts.push(`汇率 ${formatRate(item.fxAppliedRate)}`);
                        }
                        const captured = formatDate(
                          item.fxSnapshotCapturedAt ?? null,
                        );
                        if (captured) {
                          parts.push(`快照 ${captured}`);
                        }
                        detailLines.push(parts.join(" · "));
                      }
                      if (
                        displayCurrency &&
                        displayCurrency !== recordCurrency
                      ) {
                        detailLines.push(
                          `展示 ${displayCurrency}（1 ${recordCurrency} ≈ ${formatRate(item.displayRate)} ${displayCurrency}）`,
                        );
                      }
                      const monthText = monthLabel(item.month);
                      return (
                        <TableRow
                          className={cn(
                            "transition-colors",
                            item.isForecast ? "bg-muted/50" : undefined,
                          )}
                          data-testid={`${testIdPrefix}-analytics-row-${monthText}`}
                          key={item.monthDate}
                        >
                          <TableCell className="font-medium">
                            {monthText}
                            {item.isForecast ? (
                              <Badge className="ml-2" variant="outline">
                                预测
                              </Badge>
                            ) : null}
                            {item.source === "manual" ? (
                              <Badge className="ml-2" variant="secondary">
                                人工调整
                              </Badge>
                            ) : null}
                            {detailLines.length ? (
                              <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                                {detailLines.map((line, index) => (
                                  <div
                                    key={`${item.monthDate}-detail-${index}`}
                                  >
                                    {line}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatMoney(item.gross, processed.currency)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatMoney(item.bonus, processed.currency)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatMoney(item.ltcIncome, processed.currency)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatMoney(item.equityIncome, processed.currency)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-orange-600">
                            {formatMoney(
                              item.socialInsurance,
                              processed.currency,
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-orange-600">
                            {formatMoney(item.housingFund, processed.currency)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-red-600">
                            {formatMoney(item.incomeTax, processed.currency)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatMoney(
                              item.taxableCurrent,
                              processed.currency,
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatMoney(
                              item.taxableCumulative,
                              processed.currency,
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatMoney(
                              item.taxCumulative,
                              processed.currency,
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatMoney(
                              item.taxPaidCumulative,
                              processed.currency,
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold">
                            {formatMoney(item.netIncome, processed.currency)}
                          </TableCell>
                          <TableCell className="text-right">
                            {!item.isForecast && item.recordId ? (
                              <Button
                                data-testid={`${testIdPrefix}-analytics-edit-${monthText}`}
                                onClick={() => openEdit(item)}
                                size="sm"
                                variant="ghost"
                              >
                                人工调整
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog
        open={Boolean(editingItem)}
        onOpenChange={(open) => (!open ? closeEdit() : null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem
                ? `${monthLabel(editingItem.month)} 人工调整`
                : "人工调整"}
            </DialogTitle>
            <DialogDescription>
              修改税后净收入用于对账，系统会保留人工记录并在列表中标记。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">
                税后净收入（{processed.currency}）
              </span>
              <Input
                autoFocus
                disabled={submitting}
                inputMode="decimal"
                onChange={(event) => setManualNetInput(event.target.value)}
                placeholder="例如 25000.00"
                value={manualNetInput}
              />
            </div>
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">
                备注（可选）
              </span>
              <Textarea
                disabled={submitting}
                maxLength={200}
                onChange={(event) => setManualNoteInput(event.target.value)}
                placeholder="记录人工调整原因，最多 200 字"
                rows={3}
                value={manualNoteInput}
              />
            </div>
            {editingItem?.source === "manual" ? (
              <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                当前记录已由人工覆盖，保存后会继续保留人工来源。若要恢复系统计算，请使用“恢复系统值”。
              </div>
            ) : null}
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              className="sm:ml-auto"
              disabled={submitting}
              onClick={handleReset}
              type="button"
              variant="outline"
            >
              恢复系统值
            </Button>
            <Button disabled={submitting} onClick={handleSave} type="button">
              {submitting ? "保存中…" : "保存调整"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
