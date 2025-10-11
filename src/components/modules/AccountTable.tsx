"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
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
  type Account,
  archiveAccount,
  deleteAccount,
  updateAccount,
  useAccountTransactions,
} from "@/lib/api/accounts";
import type { AccountSummaryItem } from "@/lib/api/reports";
import { cn } from "@/lib/utils";
import DepositDialog from "./DepositDialog";
import TransferDialog from "./TransferDialog";
import ValuationFormDialog from "./ValuationFormDialog";
import WithdrawDialog from "./WithdrawDialog";

type NormalizedMetrics = AccountSummaryItem & {
  principal: number;
  valuation: number;
  profit: number;
  displayValue?: number;
  initialBalance: number;
};

type EnrichedAccount = Account & {
  metrics: NormalizedMetrics;
};

type AccountTableProps = {
  accounts: Account[];
  summaries: AccountSummaryItem[];
  isLoading: boolean;
  displayCurrency?: string | null;
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  SAVINGS: "储蓄",
  INVESTMENT: "投资",
  LOAN: "借贷",
  OTHER: "其他",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "在用",
  ARCHIVED: "已归档",
};

type TypeFilter = "ALL" | "ASSET" | "SAVINGS" | "INVESTMENT" | "LOAN";
type StatusFilter = "ALL" | "ACTIVE" | "ARCHIVED";

const TYPE_FILTERS: Array<{ value: TypeFilter; label: string }> = [
  { value: "ALL", label: "全部" },
  { value: "ASSET", label: "资产" },
  { value: "INVESTMENT", label: "投资" },
  { value: "LOAN", label: "借贷" },
];

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "ACTIVE", label: "在用" },
  { value: "ARCHIVED", label: "已归档" },
  { value: "ALL", label: "全部状态" },
];

const ENTRY_TYPE_LABELS: Record<string, string> = {
  DEPOSIT: "存入",
  WITHDRAW: "取出",
  TRANSFER: "转账",
  ADJUST: "调整",
  SYSTEM: "系统",
};

function formatAmount(value: number, currency: string | null | undefined) {
  if (!Number.isFinite(value)) return "-";
  try {
    if (currency) {
      return new Intl.NumberFormat("zh-CN", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(value);
    }
  } catch {
    // fallback to decimal formatting when currency is not supported
  }
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(2)}%`;
}

function formatDatetime(value: string | null | undefined) {
  if (!value) return "暂无估值";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "暂无估值";
  const datePart = date.toLocaleDateString("zh-CN");
  const timePart = date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${datePart} ${timePart}`;
}

function normalizeAccountData(
  accounts: Account[],
  summaries: AccountSummaryItem[],
): EnrichedAccount[] {
  const summaryMap = new Map<string, AccountSummaryItem>();
  summaries.forEach((summary) => {
    summaryMap.set(summary.id, summary);
  });
  const merged: EnrichedAccount[] = accounts.map((account) => {
    const summary = summaryMap.get(account.id);
    const baseMetrics: NormalizedMetrics = summary
      ? {
          ...summary,
          principal: Number(summary.principal ?? 0),
          valuation: Number(summary.valuation ?? 0),
          profit: Number(summary.profit ?? 0),
          displayValue: summary.displayValue ?? Number(summary.valuation ?? 0),
          initialBalance: Number(summary.initialBalance ?? 0),
        }
      : {
          id: account.id,
          name: account.name,
          accountType: account.accountType,
          status: account.status ?? "ACTIVE",
          subType: account.subType,
          description: account.description,
          currency: account.baseCurrency,
          initialBalance: Number(account.initialBalance ?? 0),
          principal: Number(account.initialBalance ?? 0),
          valuation: Number(account.initialBalance ?? 0),
          profit: 0,
          roi: null,
          latestValuationAt: null,
          valuationCurrency: account.baseCurrency,
          displayValue: Number(account.initialBalance ?? 0),
        };
    const resolvedStatus =
      account.status ??
      (baseMetrics.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE");
    const resolvedAccountType = (
      ["SAVINGS", "INVESTMENT", "LOAN"] as const
    ).includes(
      (baseMetrics.accountType as Account["accountType"]) ??
        account.accountType,
    )
      ? ((baseMetrics.accountType ??
          account.accountType) as Account["accountType"])
      : account.accountType;
    baseMetrics.accountType = resolvedAccountType;
    baseMetrics.status = resolvedStatus;
    return {
      ...account,
      status: resolvedStatus,
      accountType: resolvedAccountType,
      metrics: baseMetrics,
    };
  });

  summaries.forEach((summary) => {
    const exists = merged.some((account) => account.id === summary.id);
    if (!exists) {
      const fallbackStatus =
        summary.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE";
      const fallbackAccountType = (
        ["SAVINGS", "INVESTMENT", "LOAN"] as const
      ).includes(summary.accountType as Account["accountType"])
        ? (summary.accountType as Account["accountType"])
        : "INVESTMENT";
      merged.push({
        id: summary.id,
        userId: "",
        name: summary.name,
        accountType: fallbackAccountType,
        baseCurrency: summary.currency,
        subType: summary.subType ?? null,
        description: summary.description ?? null,
        status: fallbackStatus,
        initialBalance: summary.initialBalance,
        metrics: {
          ...summary,
          status: fallbackStatus,
          accountType: fallbackAccountType,
          principal: Number(summary.principal ?? 0),
          valuation: Number(summary.valuation ?? 0),
          profit: Number(summary.profit ?? 0),
          displayValue: summary.displayValue ?? Number(summary.valuation ?? 0),
          initialBalance: Number(summary.initialBalance ?? 0),
        },
      } as EnrichedAccount);
    }
  });
  return merged;
}

function shouldShowValuation(accountType: string) {
  return ["INVESTMENT", "LOAN"].includes(accountType);
}

export function AccountTable({
  accounts,
  summaries,
  isLoading,
  displayCurrency,
}: AccountTableProps) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ACTIVE");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const mergedAccounts = useMemo(
    () => normalizeAccountData(accounts, summaries),
    [accounts, summaries],
  );

  const filteredAccounts = useMemo(() => {
    const lowerCaseSearch = searchTerm.trim().toLowerCase();
    return mergedAccounts
      .filter((account) => {
        const accountType = account.metrics.accountType || account.accountType;
        if (typeFilter === "ASSET" && accountType === "LOAN") return false;
        if (
          typeFilter !== "ALL" &&
          typeFilter !== "ASSET" &&
          accountType !== typeFilter
        ) {
          return false;
        }
        const status = account.status ?? "ACTIVE";
        if (statusFilter !== "ALL" && status !== statusFilter) return false;
        if (!lowerCaseSearch) return true;
        const haystack = [
          account.name,
          account.subType ?? "",
          account.description ?? "",
          account.baseCurrency,
          account.metrics.currency,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(lowerCaseSearch);
      })
      .sort((a, b) => {
        const aValue =
          typeof a.metrics.displayValue === "number"
            ? a.metrics.displayValue
            : a.metrics.valuation;
        const bValue =
          typeof b.metrics.displayValue === "number"
            ? b.metrics.displayValue
            : b.metrics.valuation;
        return bValue - aValue;
      });
  }, [mergedAccounts, typeFilter, statusFilter, searchTerm]);

  const isEmpty = filteredAccounts.length === 0;
  const hasActiveFilter =
    typeFilter !== "ALL" ||
    statusFilter !== "ACTIVE" ||
    searchTerm.trim().length > 0;

  const pendingKey = (action: string, id: string) => `${action}:${id}`;
  const isPending = (action: string, id: string) =>
    pendingAction === pendingKey(action, id);
  const resetPending = () => setPendingAction(null);
  const parseErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error) {
      if (error.message.includes("account_has_related_records")) {
        return "账户存在交易或估值记录，无法直接删除，请确认后再试。";
      }
      return error.message;
    }
    return fallback;
  };

  const handleArchive = async (id: string) => {
    setPendingAction(pendingKey("archive", id));
    try {
      await archiveAccount(id);
      toast.success("账户已归档");
    } catch (error) {
      toast.error(parseErrorMessage(error, "归档失败，请稍后重试。"));
    } finally {
      resetPending();
    }
  };

  const handleRestore = async (id: string) => {
    setPendingAction(pendingKey("restore", id));
    try {
      await updateAccount(id, { status: "ACTIVE" });
      toast.success("账户已恢复为在用状态");
    } catch (error) {
      toast.error(parseErrorMessage(error, "恢复失败，请稍后重试。"));
    } finally {
      resetPending();
    }
  };

  const handleDelete = async (id: string) => {
    // eslint-disable-next-line no-alert
    if (
      typeof window !== "undefined" &&
      !window.confirm("删除后无法恢复，确认继续删除该账户吗？")
    ) {
      return;
    }
    setPendingAction(pendingKey("delete", id));
    try {
      await deleteAccount(id);
      toast.success("账户已删除");
      setExpandedId((prev) => (prev === id ? null : prev));
    } catch (error) {
      toast.error(
        parseErrorMessage(error, "删除失败，请检查账户是否仍有关联记录。"),
      );
    } finally {
      resetPending();
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border p-6 text-sm text-muted-foreground">
        加载中…
      </div>
    );
  }

  const renderedAccounts = filteredAccounts.map((account) => {
    const { metrics } = account;
    const accountType =
      (metrics.accountType as Account["accountType"]) ?? account.accountType;
    const status = account.status ?? "ACTIVE";
    const isArchived = status === "ARCHIVED";
    const valuationCurrency =
      displayCurrency ?? metrics.valuationCurrency ?? metrics.currency;
    const valuationValue =
      typeof metrics.displayValue === "number" && displayCurrency
        ? metrics.displayValue
        : metrics.valuation;
    const profitDisplayCurrency = displayCurrency ?? metrics.currency;
    return (
      <Card
        className="transition-all"
        data-testid={`accounts-ui-card-${account.id}`}
        key={account.id}
      >
        <CardHeader className="border-b pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base md:text-lg">
                {account.name}
              </CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-2">
                <span>{ACCOUNT_TYPE_LABELS[accountType] ?? accountType}</span>
                <span>· {account.baseCurrency}</span>
                {account.subType && (
                  <span className="text-xs text-muted-foreground">
                    · {account.subType}
                  </span>
                )}
              </CardDescription>
            </div>
            <Badge
              className="text-xs"
              variant={isArchived ? "outline" : "secondary"}
            >
              {STATUS_LABELS[status] ?? status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 text-sm md:grid-cols-4">
            <StatBlock
              label="当前估值"
              value={formatAmount(valuationValue, valuationCurrency)}
            />
            <StatBlock
              label="累计本金"
              value={formatAmount(metrics.principal, metrics.currency)}
            />
            <StatBlock
              label="收益"
              value={formatAmount(metrics.profit, profitDisplayCurrency)}
              valueClassName={cn(
                metrics.profit > 0 && "text-emerald-600",
                metrics.profit < 0 && "text-red-500",
              )}
            />
            <StatBlock label="ROI" value={formatPercent(metrics.roi)} />
          </div>
          <div
            className="flex flex-wrap items-center justify-between gap-2"
            data-testid="accounts-ui-actions"
          >
            <div className="flex flex-wrap items-center gap-2">
              {!isArchived ? (
                <>
                  <DepositDialog defaultAccountId={account.id} />
                  <WithdrawDialog defaultAccountId={account.id} />
                  <TransferDialog defaultFromId={account.id} />
                  {shouldShowValuation(accountType) && (
                    <ValuationFormDialog defaultAccountId={account.id} />
                  )}
                </>
              ) : (
                <span className="text-xs text-muted-foreground">
                  该账户已归档，无法继续入账。
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                asChild
                data-testid={`accounts-ui-action-detail-${account.id}`}
                size="sm"
                variant="ghost"
              >
                <Link href={`/accounts/${account.id}`}>查看详情</Link>
              </Button>
              {isArchived ? (
                <Button
                  data-testid={`accounts-ui-action-restore-${account.id}`}
                  disabled={isPending("restore", account.id)}
                  onClick={() => {
                    void handleRestore(account.id);
                  }}
                  size="sm"
                  variant="outline"
                >
                  恢复
                </Button>
              ) : (
                <Button
                  data-testid={`accounts-ui-action-archive-${account.id}`}
                  disabled={isPending("archive", account.id)}
                  onClick={() => {
                    void handleArchive(account.id);
                  }}
                  size="sm"
                  variant="outline"
                >
                  归档
                </Button>
              )}
              <Button
                className="border-destructive/60 text-destructive hover:bg-destructive/10"
                data-testid={`accounts-ui-action-delete-${account.id}`}
                disabled={isPending("delete", account.id)}
                onClick={() => {
                  void handleDelete(account.id);
                }}
                size="sm"
                variant="outline"
              >
                删除
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              最新估值时间：{formatDatetime(metrics.latestValuationAt)}
            </span>
            <Button
              className="h-7 px-2"
              data-testid={`accounts-ui-card-toggle-${account.id}`}
              onClick={() =>
                setExpandedId((prev) =>
                  prev === account.id ? null : account.id,
                )
              }
              size="sm"
              variant="ghost"
            >
              {expandedId === account.id ? "收起明细" : "展开明细"}
            </Button>
          </div>
          {expandedId === account.id && (
            <div
              className="rounded-lg border bg-muted/40 p-4 text-xs text-muted-foreground space-y-4"
              data-testid={`accounts-ui-card-detail-${account.id}`}
            >
              <div className="grid gap-2 md:grid-cols-2">
                <DetailRow
                  label="初始余额"
                  value={formatAmount(metrics.initialBalance, metrics.currency)}
                />
                <DetailRow
                  label="估值币种"
                  value={metrics.valuationCurrency ?? "-"}
                />
                <DetailRow
                  label="账户说明"
                  value={account.description || "暂无说明"}
                />
                <DetailRow label="账户 ID" value={account.id} />
              </div>
              <AccountTransactionsList accountId={account.id} />
            </div>
          )}
        </CardContent>
      </Card>
    );
  });

  return (
    <div className="space-y-4" data-testid="accounts-ui-list">
      <div
        className="flex flex-wrap items-center gap-2"
        data-testid="accounts-ui-filters"
      >
        <div className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map((filter) => (
            <Button
              data-testid={`accounts-ui-filter-type-${filter.value.toLowerCase()}`}
              key={filter.value}
              onClick={() => setTypeFilter(filter.value)}
              size="sm"
              variant={typeFilter === filter.value ? "default" : "outline"}
            >
              {filter.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <Button
              data-testid={`accounts-ui-filter-status-${filter.value.toLowerCase()}`}
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              size="sm"
              variant={statusFilter === filter.value ? "default" : "outline"}
            >
              {filter.label}
            </Button>
          ))}
        </div>
        <Input
          className="ms-auto w-full max-w-xs"
          data-testid="accounts-ui-search"
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="搜索名称、币种或说明"
          value={searchTerm}
        />
        {hasActiveFilter && (
          <Button
            data-testid="accounts-ui-filter-reset"
            onClick={() => {
              setTypeFilter("ALL");
              setStatusFilter("ACTIVE");
              setSearchTerm("");
            }}
            size="sm"
            variant="ghost"
          >
            重置筛选
          </Button>
        )}
      </div>
      {isEmpty ? (
        <div
          className="space-y-3 rounded-lg border border-dashed p-6 text-sm"
          data-testid="accounts-ui-empty"
        >
          <p className="text-muted-foreground">
            暂无符合条件的账户，请调整筛选或重新搜索。
          </p>
          {!hasActiveFilter && (
            <p className="text-muted-foreground">
              当前用户尚未创建任何账户，可以通过“新建账户”快速创建。
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-4">{renderedAccounts}</div>
      )}
    </div>
  );
}

function StatBlock({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-muted/50 p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-medium", valueClassName)}>{value}</span>
    </div>
  );
}

function AccountTransactionsList({ accountId }: { accountId: string }) {
  const {
    data: transactions,
    isLoading,
    error,
  } = useAccountTransactions(accountId);
  if (isLoading) {
    return (
      <div
        className="rounded border border-dashed bg-background/60 p-3 text-xs text-muted-foreground"
        data-testid={`accounts-ui-transactions-loading-${accountId}`}
      >
        交易明细加载中…
      </div>
    );
  }
  if (error) {
    return (
      <div
        className="rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
        data-testid={`accounts-ui-transactions-error-${accountId}`}
      >
        加载交易记录失败，请稍后重试。
      </div>
    );
  }
  if (!transactions || transactions.length === 0) {
    return (
      <div
        className="rounded border border-dashed bg-background/60 p-3 text-xs text-muted-foreground"
        data-testid={`accounts-ui-transactions-empty-${accountId}`}
      >
        暂无交易记录。
      </div>
    );
  }
  return (
    <div
      className="space-y-2 text-foreground"
      data-testid={`accounts-ui-transactions-${accountId}`}
    >
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
        <span>交易记录</span>
        <span>共 {transactions.length} 条</span>
      </div>
      <div className="space-y-2">
        {transactions.map((txn) => (
          <div
            className="grid gap-2 rounded border border-border/60 bg-background/70 p-3 text-xs md:grid-cols-[170px,80px,1fr]"
            data-testid={`accounts-ui-transaction-row-${txn.id}`}
            key={txn.id}
          >
            <span className="font-medium">
              {formatDatetime(txn.occurredAt)}
            </span>
            <span className="text-muted-foreground">
              {ENTRY_TYPE_LABELS[txn.type] ?? txn.type}
            </span>
            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <span
                className={cn(
                  "text-sm font-semibold",
                  txn.direction === "INFLOW" && "text-emerald-600",
                  txn.direction === "OUTFLOW" && "text-red-500",
                )}
              >
                {formatAmount(txn.amount, txn.currency)}
              </span>
              {txn.note && (
                <span className="text-muted-foreground">{txn.note}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground/90">{value}</span>
    </div>
  );
}

export default AccountTable;
