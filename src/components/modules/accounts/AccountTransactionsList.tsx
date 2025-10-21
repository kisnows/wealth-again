"use client";

import { useAccountTransactions } from "@/lib/api/accounts";
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
        {transactions.map((txn) => {
          const amountText = formatAmount(txn.amount, txn.currency);
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
              {(txn.counterpartyName ||
                txn.exchangeRateAB ||
                txn.fxEffectiveAt ||
                txn.attachmentUrl) && (
                <div className="md:col-span-3 flex flex-col gap-1 text-[11px] text-muted-foreground">
                  {txn.counterpartyName ? (
                    <span>
                      对方账户：{txn.counterpartyName}
                      {txn.counterpartyCurrency
                        ? `（${txn.counterpartyCurrency}）`
                        : ""}
                    </span>
                  ) : null}
                  {txn.exchangeRateAB ? (
                    <span>
                      汇率：1 {txn.currency} → {formatFxRate(txn.exchangeRateAB)}{" "}
                      {txn.counterpartyCurrency ?? displayCurrency ?? ""}
                      {txn.viaCurrency ? `（via ${txn.viaCurrency}）` : ""}
                    </span>
                  ) : null}
                  {txn.fxEffectiveAt ? (
                    <span>
                      汇率生效时间：{formatDateOnly(txn.fxEffectiveAt)}
                    </span>
                  ) : null}
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AccountTransactionsList;
