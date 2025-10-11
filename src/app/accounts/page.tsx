"use client";

import { useMemo } from "react";
import AccountTable from "@/components/modules/AccountTable";
import CreateAccountDialog from "@/components/modules/CreateAccountDialog";
import TransferDialog from "@/components/modules/TransferDialog";
import ValuationFormDialog from "@/components/modules/ValuationFormDialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccounts } from "@/lib/api/accounts";
import { useAccountsSummary } from "@/lib/api/reports";
import { useUserPrefsStore } from "@/lib/state/user-prefs";

const SUMMARY_CARDS = [
  { key: "assets", label: "资产总额" },
  { key: "liabilities", label: "负债总额" },
  { key: "net", label: "净资产" },
] as const;

function formatAmount(value: number, currency: string | null | undefined) {
  if (!Number.isFinite(value)) return "-";
  const fmtCurrency = currency ?? "CNY";
  try {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: fmtCurrency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return new Intl.NumberFormat("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
}

export default function AccountsPage() {
  const { displayCurrency } = useUserPrefsStore();
  const {
    data: accountList,
    isLoading: loadingAccounts,
    error: accountsError,
  } = useAccounts();
  const {
    data: summaryData,
    isLoading: loadingSummary,
    error: summaryError,
  } = useAccountsSummary(displayCurrency ?? undefined);
  const isLoading = loadingAccounts || loadingSummary;
  const hasError = accountsError || summaryError;
  const summaries = summaryData?.items ?? [];
  const totals = useMemo(() => {
    return summaries.reduce(
      (acc, item) => {
        const value =
          typeof item.displayValue === "number" && displayCurrency
            ? item.displayValue
            : item.valuation;
        if ((item.status ?? "ACTIVE") === "ARCHIVED") {
          acc.archived += value;
        }
        if (item.accountType === "LOAN") acc.liabilities += value;
        else acc.assets += value;
        return acc;
      },
      { assets: 0, liabilities: 0, archived: 0 },
    );
  }, [summaries, displayCurrency]);
  const netWorth = totals.assets - totals.liabilities;

  return (
    <main className="space-y-6 p-6" data-testid="accounts-ui-page">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">账户中心</h1>
          <p className="text-sm text-muted-foreground">
            快速浏览资产、负债与最新估值，支持一键入账与估值记录。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CreateAccountDialog />
          <TransferDialog />
          <ValuationFormDialog />
        </div>
      </header>
      <section
        className="grid gap-4 md:grid-cols-3"
        data-testid="accounts-ui-summary"
      >
        {SUMMARY_CARDS.map((card) => {
          const value =
            card.key === "assets"
              ? totals.assets
              : card.key === "liabilities"
                ? totals.liabilities
                : netWorth;
          const badge =
            card.key === "liabilities"
              ? { variant: "outline" as const, label: "负债" }
              : card.key === "assets"
                ? { variant: "secondary" as const, label: "资产" }
                : undefined;
          return (
            <Card
              key={card.key}
              className="bg-muted/40"
              data-testid={`accounts-ui-summary-card-${card.key}`}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                  <span>{card.label}</span>
                  {badge ? (
                    <Badge variant={badge.variant} className="text-xs">
                      {badge.label}
                    </Badge>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-foreground">
                  {formatAmount(
                    value,
                    displayCurrency ?? summaries[0]?.currency,
                  )}
                </p>
                {card.key === "assets" && totals.archived > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    含已归档估值{" "}
                    {formatAmount(
                      totals.archived,
                      displayCurrency ?? summaries[0]?.currency,
                    )}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </section>
      {hasError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          加载账户数据失败，请稍后重试。
        </div>
      )}
      <div>
        <AccountTable
          accounts={accountList ?? []}
          summaries={summaries}
          isLoading={isLoading}
          displayCurrency={displayCurrency ?? null}
        />
      </div>
    </main>
  );
}
