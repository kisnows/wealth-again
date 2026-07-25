"use client";

import { useAccountTransactions } from "@/lib/api/accounts";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  formatAmount,
  formatDateOnly,
  formatDatetime,
  formatFxRate,
} from "./account-format";

type AccountTransactionsListProps = {
  accountId: string;
  displayCurrency?: string | null;
};

const ENTRY_TYPE_LABELS: Record<string, string> = {
  DEPOSIT: "存入",
  WITHDRAW: "取出",
  TRANSFER: "转账",
  ADJUST: "调整",
  SYSTEM: "系统",
  FEE: "费用",
  INTEREST: "利息",
  GAIN: "收益",
};

export function AccountTransactionsList({
  accountId,
  displayCurrency,
}: AccountTransactionsListProps) {
  const {
    data: transactions,
    isLoading,
    error,
  } = useAccountTransactions(accountId);

  if (isLoading) {
    return (
      <div
        className="space-y-2"
        data-testid={`accounts-ui-transactions-loading-${accountId}`}
      >
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
          <span>交易记录</span>
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="space-y-2">
          {["tx-1", "tx-2", "tx-3"].map((key) => (
            <div
              key={key}
              className="rounded border border-border/50 bg-card/80 p-2 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-12 rounded" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="mt-1 flex items-center justify-between text-xs">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
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
        {transactions.map((txn) => {
          const amountText = formatAmount(txn.amount, txn.currency);
          const counterpartyLabel = txn.counterpartyName
            ? `${txn.counterpartyName}${
                txn.counterpartyCurrency
                  ? `（${txn.counterpartyCurrency}）`
                  : ""
              }`
            : "—";
          const formattedRateValue =
            txn.exchangeRateAB != null
              ? (formatFxRate(txn.exchangeRateAB) ??
                txn.exchangeRateAB.toFixed(6))
              : null;
          const toCurrency =
            txn.counterpartyCurrency ?? displayCurrency ?? null;
          const rateLabel =
            formattedRateValue != null
              ? `1 ${txn.currency} → ${formattedRateValue}${
                  toCurrency ? ` ${toCurrency}` : ""
                }${txn.viaCurrency ? `（via ${txn.viaCurrency}）` : ""}`
              : "—";
          const fxTimeLabel = txn.fxEffectiveAt
            ? formatDateOnly(txn.fxEffectiveAt)
            : "—";
          return (
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
                  {amountText}
                </span>
                {txn.note && (
                  <span className="text-muted-foreground">{txn.note}</span>
                )}
              </div>
              <div className="md:col-span-3 flex flex-col gap-1 text-[11px] text-muted-foreground">
                <span>对方账户：{counterpartyLabel}</span>
                <span>汇率：{rateLabel}</span>
                <span>汇率生效时间：{fxTimeLabel}</span>
                {txn.attachmentUrl ? (
                  <span>
                    附件：
                    <a
                      className="underline hover:text-primary"
                      data-testid={`accounts-ui-transaction-attachment-${txn.id}`}
                      href={txn.attachmentUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      查看附件
                    </a>
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AccountTransactionsList;
