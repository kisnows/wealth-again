"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  type AccountTransaction,
  useAccountTransactions,
} from "@/lib/api/accounts";
import { useLatestFxRates } from "@/lib/api/fx";
import { cn } from "@/lib/utils";
import {
  formatAmount,
  formatDateOnly,
  formatDatetime,
  formatFxRate,
} from "./account-format";

const PAGE_SIZE = 10;

type AccountTransactionsTableProps = {
  accountId: string;
  accountCurrency: string;
  displayCurrency?: string | null;
};

const ENTRY_TYPE_LABELS: Record<string, string> = {
  ALL: "全部类型",
  DEPOSIT: "存入",
  WITHDRAW: "取出",
  TRANSFER: "转账",
  ADJUST: "调整",
  FEE: "费用",
  INTEREST: "利息",
  GAIN: "收益",
  SYSTEM: "系统",
};

type FilterState = {
  type: keyof typeof ENTRY_TYPE_LABELS;
  from: string;
  to: string;
  minAmount: string;
  maxAmount: string;
  search: string;
};

function parseFilterDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function withinDateRange(txn: AccountTransaction, from?: Date | null, to?: Date | null) {
  const occurred = new Date(txn.occurredAt);
  if (from && occurred < from) return false;
  if (to && occurred > to) return false;
  return true;
}

function withinAmountRange(
  txn: AccountTransaction,
  minAmount?: number | null,
  maxAmount?: number | null,
) {
  const value = Math.abs(txn.amount);
  if (minAmount != null && value < minAmount) return false;
  if (maxAmount != null && value > maxAmount) return false;
  return true;
}

function matchSearch(txn: AccountTransaction, keyword: string) {
  if (!keyword) return true;
  const lower = keyword.toLowerCase();
  return [
    txn.note ?? "",
    txn.counterpartyName ?? "",
    txn.entryNote ?? "",
    txn.lineNote ?? "",
  ]
    .join(" ")
    .toLowerCase()
    .includes(lower);
}

function computeConvertedAmount(
  txn: AccountTransaction,
  accountCurrency: string,
  displayCurrency: string | null | undefined,
  usdToAccount: number | null,
  usdToDisplay: number | null,
) {
  const normalizedDisplay = displayCurrency ?? accountCurrency;
  if (normalizedDisplay === accountCurrency) {
    return { amount: txn.amount, currency: accountCurrency, source: "self" };
  }
  const usdToDisplayRate = normalizedDisplay === "USD" ? 1 : usdToDisplay;
  if (usdToDisplayRate == null || usdToDisplayRate === 0) {
    return { amount: null, currency: normalizedDisplay, source: "missing" };
  }
  // 优先使用交易快照中的汇率
  if (txn.rateAtoUSD && Number.isFinite(txn.rateAtoUSD)) {
    const converted = txn.amount * txn.rateAtoUSD * usdToDisplayRate;
    return { amount: converted, currency: normalizedDisplay, source: "snapshot" };
  }
  const usdPerAccount =
    accountCurrency === "USD"
      ? 1
      : usdToAccount && usdToAccount !== 0
        ? 1 / usdToAccount
        : null;
  if (usdPerAccount == null) {
    return { amount: null, currency: normalizedDisplay, source: "missing" };
  }
  const converted = txn.amount * usdPerAccount * usdToDisplayRate;
  return { amount: converted, currency: normalizedDisplay, source: "latest" };
}

function exportToCsv(
  rows: Array<{
    occurredAt: string;
    type: string;
    amount: number;
    currency: string;
    convertedAmount: number | null;
    convertedCurrency: string | null;
    exchangeRate: number | null;
    counterparty: string | null;
    note: string | null;
    attachment: string | null;
  }>,
) {
  if (rows.length === 0) return;
  const header = [
    "发生时间",
    "类型",
    "原币金额",
    "原币币种",
    "折算金额",
    "折算币种",
    "汇率",
    "对方账户",
    "备注",
    "附件链接",
  ];
  const csvContent = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.occurredAt,
        row.type,
        row.amount,
        row.currency,
        row.convertedAmount ?? "",
        row.convertedCurrency ?? "",
        row.exchangeRate ?? "",
        row.counterparty ?? "",
        row.note ?? "",
        row.attachment ?? "",
      ]
        .map((value) => {
          if (value == null) return "";
          const str = String(value);
          if (str.includes(",") || str.includes("\n") || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(","),
    ),
  ].join("\n");

  if (typeof window !== "undefined") {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "account-transactions.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export function AccountTransactionsTable({
  accountId,
  accountCurrency,
  displayCurrency,
}: AccountTransactionsTableProps) {
  const { data: transactions, isLoading, error } = useAccountTransactions(accountId);
  const [filters, setFilters] = useState<FilterState>({
    type: "ALL",
    from: "",
    to: "",
    minAmount: "",
    maxAmount: "",
    search: "",
  });
  const [page, setPage] = useState(0);
  const updateFilters = (
    updater: FilterState | ((prev: FilterState) => FilterState),
  ) => {
    setFilters((prev) => {
      const next =
        typeof updater === "function"
          ? (updater as (prevState: FilterState) => FilterState)(prev)
          : updater;
      if (
        next.type !== prev.type ||
        next.from !== prev.from ||
        next.to !== prev.to ||
        next.minAmount !== prev.minAmount ||
        next.maxAmount !== prev.maxAmount ||
        next.search !== prev.search
      ) {
        setPage(0);
      }
      return next;
    });
  };

  const fxQuotes = useMemo(() => {
    const quotes = new Set<string>();
    if (accountCurrency.toUpperCase() !== "USD") {
      quotes.add(accountCurrency.toUpperCase());
    }
    if (
      displayCurrency &&
      displayCurrency.toUpperCase() !== "USD" &&
      displayCurrency.toUpperCase() !== accountCurrency.toUpperCase()
    ) {
      quotes.add(displayCurrency.toUpperCase());
    }
    return Array.from(quotes);
  }, [accountCurrency, displayCurrency]);

  const { data: latestFx } = useLatestFxRates(fxQuotes);
  const usdToAccount =
    accountCurrency.toUpperCase() === "USD"
      ? 1
      : latestFx?.items.find(
          (item) => item.quote.toUpperCase() === accountCurrency.toUpperCase(),
        )?.rate ?? null;
  const usdToDisplay =
    !displayCurrency || displayCurrency.toUpperCase() === "USD"
      ? 1
      : latestFx?.items.find(
          (item) => item.quote.toUpperCase() === displayCurrency.toUpperCase(),
        )?.rate ?? null;

  const filtered = useMemo(() => {
    if (!transactions) return [];
    const fromDate = parseFilterDate(filters.from);
    const toDateValue = parseFilterDate(filters.to);
    const minAmount =
      filters.minAmount.trim().length > 0
        ? Number.isFinite(Number(filters.minAmount))
          ? Number(filters.minAmount)
          : null
        : null;
    const maxAmount =
      filters.maxAmount.trim().length > 0
        ? Number.isFinite(Number(filters.maxAmount))
          ? Number(filters.maxAmount)
          : null
        : null;

    return transactions
      .filter((txn) => {
        if (filters.type !== "ALL" && txn.type !== filters.type) return false;
        if (!withinDateRange(txn, fromDate, toDateValue)) return false;
        if (!withinAmountRange(txn, minAmount, maxAmount)) return false;
        if (!matchSearch(txn, filters.search)) return false;
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      );
  }, [transactions, filters]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const viewRows = paginated.map((txn) => {
    const converted = computeConvertedAmount(
      txn,
      accountCurrency,
      displayCurrency,
      usdToAccount,
      usdToDisplay,
    );
    return { txn, converted };
  });

  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    (transactions ?? []).forEach((txn) => {
      set.add(txn.type);
    });
    return Array.from(set);
  }, [transactions]);

  if (isLoading) {
    return (
      <div className="rounded border border-dashed p-4 text-sm text-muted-foreground">
        交易记录加载中…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        交易记录加载失败，请稍后重试。
      </div>
    );
  }

  const canExport = filtered.length > 0;

  return (
    <div className="space-y-4" data-testid="accounts-detail-transactions">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            data-testid="accounts-detail-filter-type-all"
            onClick={() => updateFilters((prev) => ({ ...prev, type: "ALL" }))}
            size="sm"
            variant={filters.type === "ALL" ? "default" : "outline"}
          >
            {ENTRY_TYPE_LABELS.ALL}
          </Button>
          {availableTypes.map((type) => (
            <Button
              data-testid={`accounts-detail-filter-type-${type.toLowerCase()}`}
              key={type}
              onClick={() =>
                updateFilters((prev) => ({
                  ...prev,
                  type: type as keyof typeof ENTRY_TYPE_LABELS,
                }))
              }
              size="sm"
              variant={filters.type === type ? "default" : "outline"}
            >
              {ENTRY_TYPE_LABELS[type] ?? type}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            className="w-36"
            data-testid="accounts-detail-filter-from"
            onChange={(event) =>
              updateFilters((prev) => ({ ...prev, from: event.target.value }))
            }
            placeholder="起始日期"
            type="date"
            value={filters.from}
          />
          <Input
            className="w-36"
            data-testid="accounts-detail-filter-to"
            onChange={(event) =>
              updateFilters((prev) => ({ ...prev, to: event.target.value }))
            }
            placeholder="结束日期"
            type="date"
            value={filters.to}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            className="w-28"
            data-testid="accounts-detail-filter-min"
            onChange={(event) =>
              updateFilters((prev) => ({
                ...prev,
                minAmount: event.target.value,
              }))
            }
            placeholder="最小金额"
            type="number"
            value={filters.minAmount}
          />
          <Input
            className="w-28"
            data-testid="accounts-detail-filter-max"
            onChange={(event) =>
              updateFilters((prev) => ({
                ...prev,
                maxAmount: event.target.value,
              }))
            }
            placeholder="最大金额"
            type="number"
            value={filters.maxAmount}
          />
        </div>
        <Input
          className="ms-auto w-full max-w-xs"
          data-testid="accounts-detail-filter-search"
          onChange={(event) =>
            updateFilters((prev) => ({ ...prev, search: event.target.value }))
          }
          placeholder="搜索备注或对方账户"
          value={filters.search}
        />
        <Button
          data-testid="accounts-detail-filter-reset"
          onClick={() =>
            updateFilters({
              type: "ALL",
              from: "",
              to: "",
              minAmount: "",
              maxAmount: "",
              search: "",
            })
          }
          size="sm"
          variant="ghost"
        >
          重置
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          共 {filtered.length} 条记录
          {filters.type !== "ALL" ? ` · 当前类型：${ENTRY_TYPE_LABELS[filters.type] ?? filters.type}` : ""}
        </span>
        <Button
          data-testid="accounts-detail-export"
          disabled={!canExport}
          onClick={() =>
            exportToCsv(
              filtered.map((txn) => {
                const converted = computeConvertedAmount(
                  txn,
                  accountCurrency,
                  displayCurrency,
                  usdToAccount,
                  usdToDisplay,
                );
                return {
                  occurredAt: formatDatetime(txn.occurredAt),
                  type: ENTRY_TYPE_LABELS[txn.type] ?? txn.type,
                  amount: txn.amount,
                  currency: txn.currency,
                  convertedAmount: converted.amount,
                  convertedCurrency: converted.currency ?? null,
                  exchangeRate: txn.exchangeRateAB,
                  counterparty: txn.counterpartyName,
                  note: txn.note,
                  attachment: txn.attachmentUrl,
                };
              }),
            )
          }
          size="sm"
          variant="outline"
        >
          导出 CSV
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border" data-testid="accounts-detail-table">
        <table className="min-w-full text-sm">
          <thead className="bg-muted">
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">日期</th>
              <th className="px-4 py-3">类型</th>
              <th className="px-4 py-3">原币金额</th>
              <th className="px-4 py-3">折算金额</th>
              <th className="px-4 py-3">汇率</th>
              <th className="px-4 py-3">对方账户</th>
              <th className="px-4 py-3">备注</th>
              <th className="px-4 py-3">附件</th>
            </tr>
          </thead>
          <tbody>
            {viewRows.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-6 text-center text-sm text-muted-foreground"
                  colSpan={8}
                >
                  暂无符合筛选条件的记录。
                </td>
              </tr>
            ) : (
              viewRows.map(({ txn, converted }) => (
                <tr
                  className="border-t border-border/60"
                  data-testid={`accounts-detail-row-${txn.id}`}
                  key={txn.id}
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    {formatDatetime(txn.occurredAt)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {ENTRY_TYPE_LABELS[txn.type] ?? txn.type}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 font-medium",
                      txn.direction === "INFLOW" && "text-emerald-600",
                      txn.direction === "OUTFLOW" && "text-red-500",
                    )}
                  >
                    {formatAmount(txn.amount, txn.currency)}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {converted.amount != null
                      ? formatAmount(converted.amount, converted.currency)
                      : "—"}
                    {converted.source === "latest" ? (
                      <Badge
                        className="ms-2 align-middle"
                        variant="outline"
                      >
                        最新汇率
                      </Badge>
                    ) : converted.source === "snapshot" ? (
                      <Badge
                        className="ms-2 align-middle"
                        variant="secondary"
                      >
                        快照
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {txn.exchangeRateAB
                      ? `1 ${txn.currency} → ${formatFxRate(txn.exchangeRateAB)} ${txn.counterpartyCurrency ?? displayCurrency ?? ""}${
                          txn.viaCurrency ? `（via ${txn.viaCurrency}）` : ""
                        }`
                      : "—"}
                    {txn.fxEffectiveAt ? (
                      <div>生效：{formatDateOnly(txn.fxEffectiveAt)}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {txn.counterpartyName
                      ? `${txn.counterpartyName}${
                          txn.counterpartyCurrency
                            ? `（${txn.counterpartyCurrency}）`
                            : ""
                        }`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {txn.note ? (
                      <span className="text-muted-foreground">{txn.note}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {txn.attachmentUrl ? (
                      <a
                        className="text-primary underline underline-offset-2"
                        data-testid={`accounts-detail-attachment-${txn.id}`}
                        href={txn.attachmentUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        查看
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          第 {filtered.length === 0 ? 0 : page + 1} / {Math.max(totalPages, 1)} 页
        </span>
        <div className="flex items-center gap-2">
          <Button
            data-testid="accounts-detail-pagination-prev"
            disabled={page === 0}
            onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
            size="sm"
            variant="outline"
          >
            上一页
          </Button>
          <Button
            data-testid="accounts-detail-pagination-next"
            disabled={page >= totalPages - 1 || totalPages === 0}
            onClick={() =>
              setPage((prev) =>
                Math.min(prev + 1, Math.max(totalPages - 1, 0)),
              )
            }
            size="sm"
            variant="outline"
          >
            下一页
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AccountTransactionsTable;
