"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { EnrichedAccount, NormalizedMetrics } from "./account-table-utils";
import {
  ACCOUNT_TYPE_LABELS,
  STATUS_LABELS,
  shouldShowValuation,
} from "./account-table-utils";
import {
  formatAmount,
  formatDatetime,
  formatPercent,
} from "./account-format";
import { cn } from "@/lib/utils";
import DepositDialog from "./DepositDialog";
import TransferDialog from "./TransferDialog";
import ValuationFormDialog from "./ValuationFormDialog";
import WithdrawDialog from "./WithdrawDialog";
import { AccountTransactionsList } from "./AccountTransactionsList";

type PendingAction = "archive" | "restore" | "delete";

type AccountCardProps = {
  account: EnrichedAccount;
  displayCurrency?: string | null;
  expanded: boolean;
  onToggle: () => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  isPending: (action: PendingAction, id: string) => boolean;
};

function buildStatDetail(
  displayValue: number | undefined,
  originalValue: number,
  originalCurrency: string,
) {
  if (!Number.isFinite(displayValue ?? Number.NaN)) return undefined;
  return `原币 ${formatAmount(originalValue, originalCurrency)}`;
}

function StatBlock({
  label,
  value,
  detail,
  valueClassName,
}: {
  label: string;
  value: string;
  detail?: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-muted/50 p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-medium", valueClassName)}>{value}</span>
      {detail ? (
        <span className="text-[11px] text-muted-foreground/80">{detail}</span>
      ) : null}
    </div>
  );
}

function DetailRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground/90">{value}</span>
      {detail ? (
        <span className="text-[11px] text-muted-foreground/80">{detail}</span>
      ) : null}
    </div>
  );
}

function resolveDisplayValue(
  metrics: NormalizedMetrics,
  displayCurrency?: string | null,
) {
  if (
    displayCurrency &&
    typeof metrics.displayValue === "number" &&
    Number.isFinite(metrics.displayValue)
  ) {
    return {
      value: metrics.displayValue,
      currency: displayCurrency,
      detail: buildStatDetail(
        metrics.displayValue,
        metrics.valuation,
        metrics.valuationCurrency ?? metrics.currency,
      ),
    };
  }
  return {
    value: Number(metrics.valuation ?? 0),
    currency: metrics.valuationCurrency ?? metrics.currency,
    detail: undefined,
  };
}

function resolvePrincipalValue(
  metrics: NormalizedMetrics,
  displayCurrency?: string | null,
) {
  if (
    displayCurrency &&
    typeof metrics.displayPrincipal === "number" &&
    Number.isFinite(metrics.displayPrincipal)
  ) {
    return {
      value: metrics.displayPrincipal,
      currency: displayCurrency,
      detail: buildStatDetail(
        metrics.displayPrincipal,
        metrics.principal,
        metrics.currency,
      ),
    };
  }
  return {
    value: Number(metrics.principal ?? 0),
    currency: metrics.currency,
    detail: undefined,
  };
}

function resolveProfitValue(
  metrics: NormalizedMetrics,
  displayCurrency?: string | null,
) {
  if (
    displayCurrency &&
    typeof metrics.displayProfit === "number" &&
    Number.isFinite(metrics.displayProfit)
  ) {
    return {
      value: metrics.displayProfit,
      currency: displayCurrency,
      detail: buildStatDetail(
        metrics.displayProfit,
        metrics.profit,
        metrics.currency,
      ),
    };
  }
  return {
    value: Number(metrics.profit ?? 0),
    currency: metrics.currency,
    detail: undefined,
  };
}

export function AccountCard({
  account,
  displayCurrency,
  expanded,
  onToggle,
  onArchive,
  onRestore,
  onDelete,
  isPending,
}: AccountCardProps) {
  const { metrics } = account;
  const accountType = metrics.accountType ?? account.accountType;
  const status = account.status ?? "ACTIVE";
  const isArchived = status === "ARCHIVED";

  const valuation = resolveDisplayValue(metrics, displayCurrency);
  const principal = resolvePrincipalValue(metrics, displayCurrency);
  const profit = resolveProfitValue(metrics, displayCurrency);
  const initial = displayCurrency
    ? {
        value: metrics.displayInitialBalance ?? metrics.initialBalance,
        currency: displayCurrency,
        detail: buildStatDetail(
          metrics.displayInitialBalance,
          metrics.initialBalance,
          metrics.currency,
        ),
      }
    : {
        value: metrics.initialBalance,
        currency: metrics.currency,
        detail: undefined,
      };

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
            detail={valuation.detail}
            label="当前估值"
            value={formatAmount(valuation.value, valuation.currency)}
          />
          <StatBlock
            detail={principal.detail}
            label="累计本金"
            value={formatAmount(principal.value, principal.currency)}
          />
          <StatBlock
            detail={profit.detail}
            label="收益"
            value={formatAmount(profit.value, profit.currency)}
            valueClassName={cn(
              profit.value > 0 && "text-emerald-600",
              profit.value < 0 && "text-red-500",
            )}
          />
          <StatBlock
            label="ROI"
            value={formatPercent(metrics.roi)}
          />
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
                onClick={() => onRestore(account.id)}
                size="sm"
                variant="outline"
              >
                恢复
              </Button>
            ) : (
              <Button
                data-testid={`accounts-ui-action-archive-${account.id}`}
                disabled={isPending("archive", account.id)}
                onClick={() => onArchive(account.id)}
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
              onClick={() => onDelete(account.id)}
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
            onClick={onToggle}
            size="sm"
            variant="ghost"
          >
            {expanded ? "收起明细" : "展开明细"}
          </Button>
        </div>
        {expanded ? (
          <div
            className="space-y-4 rounded-lg border bg-muted/40 p-4 text-xs text-muted-foreground"
            data-testid={`accounts-ui-card-detail-${account.id}`}
          >
            <div className="grid gap-2 md:grid-cols-2">
              <DetailRow
                detail={initial.detail}
                label="初始余额"
                value={formatAmount(initial.value, initial.currency)}
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
            <AccountTransactionsList
              accountId={account.id}
              displayCurrency={displayCurrency}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default AccountCard;
