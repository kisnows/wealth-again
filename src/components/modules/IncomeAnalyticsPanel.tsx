"use client";

import {
  AlertCircleIcon,
  BanknoteIcon,
  BarChart3Icon,
  CalendarIcon,
  PercentIcon,
  DollarSignIcon,
  TrendingUpIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import IncomeStackedBar from "@/components/modules/Charts/IncomeStackedBar";
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
import { useIncomeTimeseries } from "@/lib/api/reports";
import { formatMoney } from "@/lib/domain/money";
import { useUserPrefsStore } from "@/lib/state/user-prefs";

type IncomeRow = {
  month: string;
  gross: number;
  bonus: number;
  ltcIncome: number;
  equityIncome: number;
  socialInsurance: number;
  housingFund: number;
  incomeTax: number;
  netIncome: number;
};

type Props = {
  testIdPrefix: string;
  defaultFrom?: string;
  defaultTo?: string;
  title?: string;
  description?: string;
  showHeaderBadge?: boolean;
};

function toMonthLabel(value: string) {
  if (!value) return "";
  if (value.length >= 7) return value.slice(0, 7);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : parsed.toISOString().slice(0, 7);
}

export default function IncomeAnalyticsPanel({
  testIdPrefix,
  defaultFrom,
  defaultTo,
  title = "收入概览",
  description = "统计指定时间范围的收入、扣除与税额，确保所有页面读取统一数据来源。",
  showHeaderBadge = false,
}: Props) {
  const currentYear = new Date().getFullYear();
  const [range, setRange] = useState(() => ({
    from: defaultFrom ?? `${currentYear}-01-01`,
    to: defaultTo ?? `${currentYear}-12-01`,
  }));
  const { displayCurrency } = useUserPrefsStore();
  const { data, isLoading, error } = useIncomeTimeseries(
    undefined,
    range.from,
    range.to,
  );

  const processed = useMemo(() => {
    if (!data?.series) {
      return {
        rows: [] as IncomeRow[],
        statistics: null as null | {
          totalIncome: number;
          totalDeductions: number;
          totalNet: number;
          effectiveTaxRate: number;
          avgMonthlyNet: number;
          months: number;
          breakdown: IncomeRow;
          currency: string;
        },
      };
    }

    const rows: IncomeRow[] = (data.series.gross ?? []).map(
      (gross: any, index: number) => ({
        month: toMonthLabel(String(gross.month)),
        gross: Number(gross.value || 0),
        bonus: Number(data.series.bonus?.[index]?.value || 0),
        ltcIncome: Number(data.series.ltcIncome?.[index]?.value || 0),
        equityIncome: Number(data.series.equityIncome?.[index]?.value || 0),
        socialInsurance: Number(
          data.series.socialInsurance?.[index]?.value || 0,
        ),
        housingFund: Number(data.series.housingFund?.[index]?.value || 0),
        incomeTax: Number(data.series.incomeTax?.[index]?.value || 0),
        netIncome: Number(data.series.netIncome?.[index]?.value || 0),
      }),
    );

    if (rows.length === 0) {
      return { rows, statistics: null };
    }

    const totals = rows.reduce(
      (acc, row) => ({
        gross: acc.gross + row.gross,
        bonus: acc.bonus + row.bonus,
        ltcIncome: acc.ltcIncome + row.ltcIncome,
        equityIncome: acc.equityIncome + row.equityIncome,
        socialInsurance: acc.socialInsurance + row.socialInsurance,
        housingFund: acc.housingFund + row.housingFund,
        incomeTax: acc.incomeTax + row.incomeTax,
        netIncome: acc.netIncome + row.netIncome,
      }),
      {
        gross: 0,
        bonus: 0,
        ltcIncome: 0,
        equityIncome: 0,
        socialInsurance: 0,
        housingFund: 0,
        incomeTax: 0,
        netIncome: 0,
      },
    );

    const totalIncome =
      totals.gross + totals.bonus + totals.ltcIncome + totals.equityIncome;
    const totalDeductions =
      totals.socialInsurance + totals.housingFund + totals.incomeTax;
    const effectiveTaxRate =
      totalIncome > 0 ? (totals.incomeTax / totalIncome) * 100 : 0;
    const avgMonthlyNet = rows.length > 0 ? totals.netIncome / rows.length : 0;

    return {
      rows,
      statistics: {
        totalIncome,
        totalDeductions,
        totalNet: totals.netIncome,
        effectiveTaxRate,
        avgMonthlyNet,
        months: rows.length,
        breakdown: totals,
        currency: data.summary?.currency ?? displayCurrency ?? "CNY",
      },
    };
  }, [data, displayCurrency]);

  const chartItems = processed.rows.map((item) => ({
    month: item.month,
    gross: item.gross,
    bonus: item.bonus,
    ltcIncome: item.ltcIncome,
    equityIncome: item.equityIncome,
    socialInsurance: item.socialInsurance,
    housingFund: item.housingFund,
    incomeTax: item.incomeTax,
  }));

  const displayCurrencyLabel =
    processed.statistics?.currency ?? displayCurrency ?? "CNY";

  const setRangePart = (key: "from" | "to", value: string) => {
    setRange((prev) => ({ ...prev, [key]: value }));
  };

  if (error) {
    return (
      <Card data-testid={`${testIdPrefix}-analytics-error`}>
        <CardContent className="flex items-center gap-3 py-8 text-sm text-destructive">
          <AlertCircleIcon className="h-5 w-5 shrink-0" />
          <span>收入数据加载失败，请稍后重试。</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      className="space-y-6"
      data-testid={`${testIdPrefix}-analytics-panel`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {showHeaderBadge ? (
          <Badge variant="outline">数据源：IncomeRecord</Badge>
        ) : null}
      </div>

      <Card data-testid={`${testIdPrefix}-analytics-range`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarIcon className="h-5 w-5 text-primary" />
            统计区间
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            可快速选择常用区间，所有展示组件都会同步更新。
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
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            正在加载收入数据...
          </CardContent>
        </Card>
      ) : processed.statistics ? (
        <>
          <Card data-testid={`${testIdPrefix}-analytics-summary`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSignIcon className="h-5 w-5 text-primary" />
                收入摘要（{displayCurrencyLabel}）
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                基于 {processed.statistics.months} 个月数据的累计指标。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <SummaryCard
                  icon={<BanknoteIcon className="h-4 w-4 text-primary" />}
                  label="总收入"
                  testId={`${testIdPrefix}-analytics-total-income`}
                  value={formatMoney(
                    processed.statistics.totalIncome,
                    displayCurrencyLabel,
                  )}
                />
                <SummaryCard
                  icon={<TrendingUpIcon className="h-4 w-4 text-emerald-600" />}
                  label="净收入"
                  testId={`${testIdPrefix}-analytics-total-net`}
                  value={formatMoney(
                    processed.statistics.totalNet,
                    displayCurrencyLabel,
                  )}
                />
                <SummaryCard
                  icon={<BarChart3Icon className="h-4 w-4 text-amber-600" />}
                  label="总扣除"
                  testId={`${testIdPrefix}-analytics-total-deduction`}
                  value={formatMoney(
                    processed.statistics.totalDeductions,
                    displayCurrencyLabel,
                  )}
                />
                <SummaryCard
                  icon={<PercentIcon className="h-4 w-4 text-sky-600" />}
                  label="有效税率"
                  testId={`${testIdPrefix}-analytics-effective-tax`}
                  value={`${processed.statistics.effectiveTaxRate.toFixed(1)}%`}
                  helper={`月均净收入 ${formatMoney(
                    processed.statistics.avgMonthlyNet,
                    displayCurrencyLabel,
                  )}`}
                />
              </div>
            </CardContent>
          </Card>

          <Card data-testid={`${testIdPrefix}-analytics-chart`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3Icon className="h-5 w-5 text-primary" />
                月度结构
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                展示选定区间内税前收入、奖金、扣除与税额的堆叠走势。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IncomeStackedBar items={chartItems} />
            </CardContent>
          </Card>

          <Card data-testid={`${testIdPrefix}-analytics-table`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSignIcon className="h-5 w-5 text-primary" />
                月度明细
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                单个月份的税前、奖金、社保、公积金、个税与净收入，方便对账。
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
                      <TableHead className="text-right">股权</TableHead>
                      <TableHead className="text-right">社保</TableHead>
                      <TableHead className="text-right">公积金</TableHead>
                      <TableHead className="text-right">个税</TableHead>
                      <TableHead className="text-right">净收入</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processed.rows.map((row) => (
                      <TableRow
                        data-testid={`${testIdPrefix}-analytics-row-${row.month}`}
                        key={row.month}
                      >
                        <TableCell className="font-medium">{row.month}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatMoney(row.gross, displayCurrencyLabel)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatMoney(row.bonus, displayCurrencyLabel)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatMoney(row.ltcIncome, displayCurrencyLabel)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatMoney(row.equityIncome, displayCurrencyLabel)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatMoney(row.socialInsurance, displayCurrencyLabel)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatMoney(row.housingFund, displayCurrencyLabel)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatMoney(row.incomeTax, displayCurrencyLabel)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatMoney(row.netIncome, displayCurrencyLabel)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card data-testid={`${testIdPrefix}-analytics-empty`}>
          <CardContent className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
            <AlertCircleIcon className="h-5 w-5 shrink-0" />
            <span>当前区间暂无收入记录。</span>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  helper,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper?: string;
  testId: string;
}) {
  return (
    <div
      className="space-y-2 rounded-lg border border-border/60 bg-card/80 p-4 shadow-sm"
      data-testid={testId}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <div className="text-xl font-semibold text-foreground">{value}</div>
      {helper ? (
        <div className="text-xs text-muted-foreground">{helper}</div>
      ) : null}
    </div>
  );
}
