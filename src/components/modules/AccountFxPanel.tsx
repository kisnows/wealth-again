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
import { createFxRate, useLatestFxRates } from "@/lib/api/fx";

type AccountFxPanelProps = {
  currencies: string[];
  displayCurrency?: string | null;
};

const BASE_CURRENCY = "USD";

export default function AccountFxPanel({
  currencies,
  displayCurrency,
}: AccountFxPanelProps) {
  const [formCurrency, setFormCurrency] = useState<string>("");
  const [formRate, setFormRate] = useState<string>("");
  const [formAsOf, setFormAsOf] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const effectiveCurrencies = useMemo(() => {
    return Array.from(
      new Set(
        currencies
          .map((code) => code.toUpperCase())
          .filter((code) => code.length > 0 && code !== BASE_CURRENCY),
      ),
    ).sort();
  }, [currencies]);

  useEffect(() => {
    if (!formCurrency && effectiveCurrencies.length > 0) {
      setFormCurrency(effectiveCurrencies[0]);
    }
  }, [effectiveCurrencies, formCurrency]);

  const { data, isLoading, error, mutate } = useLatestFxRates(effectiveCurrencies);
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
        asOf: snapshot?.asOf ?? null,
      };
    });
  }, [effectiveCurrencies, data]);

  const summaryKey = displayCurrency
    ? `/api/v1/reports/accounts/summary?displayCurrency=${displayCurrency}`
    : "/api/v1/reports/accounts/summary";

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
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
    if (!formAsOf) {
      toast.error("请选择汇率生效日期");
      return;
    }
    setSubmitting(true);
    try {
      await createFxRate({
        base: BASE_CURRENCY,
        quote: formCurrency,
        rate: rateValue,
        asOf: new Date(formAsOf).toISOString(),
      });
      toast.success("汇率快照已保存");
      setFormRate("");
      setFormAsOf("");
      await Promise.all([
        mutate(),
        mutateGlobal(summaryKey),
      ]);
    } catch (err) {
      console.error("create fx rate error", err);
      toast.error("保存失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card data-testid="accounts-ui-fx-panel">
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
            汇率快照
          </CardTitle>
          <CardDescription>
            统一维护账户涉及币种的 USD 中间价，更新后自动刷新账户估值与报表。
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">基础币种: {BASE_CURRENCY}</Badge>
          {displayCurrencyUpper ? (
            <Badge variant="secondary">
              展示币种: {displayCurrencyUpper}
            </Badge>
          ) : (
            <Badge variant="secondary">展示币种: 自动</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {effectiveCurrencies.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground" data-testid="accounts-ui-fx-empty">
            当前账户仅使用 USD，无需维护额外汇率。
          </div>
        ) : error ? (
          <div className="rounded-md border border-dashed border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive" data-testid="accounts-ui-fx-error">
            汇率数据加载失败，请稍后刷新或重新登录。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table data-testid="accounts-ui-fx-table">
              <TableHeader>
                <TableRow>
                  <TableHead>币种</TableHead>
                  <TableHead>汇率（1 USD）</TableHead>
                  <TableHead>最新快照日期</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      className="text-sm text-muted-foreground"
                      colSpan={4}
                    >
                      加载中…
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const isDisplayCurrency =
                      displayCurrencyUpper === row.quote;
                    const hasRate = row.rate != null && Number.isFinite(row.rate);
                    return (
                      <TableRow
                        data-testid={`accounts-ui-fx-row-${row.quote}`}
                        key={row.quote}
                      >
                        <TableCell className="font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <span>{row.quote}</span>
                            {isDisplayCurrency ? (
                              <Badge variant="secondary">展示币种</Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {hasRate ? row.rate?.toFixed(4) : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.asOf
                            ? new Date(row.asOf).toLocaleDateString("zh-CN")
                            : "尚未设置"}
                        </TableCell>
                        <TableCell>
                          {hasRate ? (
                            <Badge variant="outline">已设置</Badge>
                          ) : (
                            <Badge className="bg-amber-500/10 text-amber-600" variant="secondary">
                              缺失
                            </Badge>
                          )}
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
            className="grid gap-3 md:grid-cols-[minmax(0,220px)_minmax(0,200px)_minmax(0,180px)_minmax(0,160px)]"
            data-testid="accounts-ui-fx-form"
            onSubmit={handleSubmit}
          >
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="fx-currency">
                币种
              </label>
              <Select
                onValueChange={setFormCurrency}
                value={formCurrency}
              >
                <SelectTrigger data-testid="accounts-ui-fx-select" id="fx-currency">
                  <SelectValue placeholder="选择币种" />
                </SelectTrigger>
                <SelectContent>
                  {effectiveCurrencies.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="fx-rate">
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
              <label className="text-xs font-medium text-muted-foreground" htmlFor="fx-asof">
                生效日期
              </label>
              <Input
                data-testid="accounts-ui-fx-date"
                id="fx-asof"
                onChange={(event) => setFormAsOf(event.target.value)}
                type="date"
                value={formAsOf}
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
      </CardContent>
    </Card>
  );
}
