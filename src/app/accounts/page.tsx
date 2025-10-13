"use client";

import { useMemo } from "react";
import AccountTable from "@/components/modules/AccountTable";
import AccountFxPanel from "@/components/modules/AccountFxPanel";
import CreateAccountDialog from "@/components/modules/CreateAccountDialog";
import TransferDialog from "@/components/modules/TransferDialog";
import ValuationFormDialog from "@/components/modules/ValuationFormDialog";
import {
  PageContainer,
  PageHeader,
  PageSection,
} from "@/components/modules/PageLayout";
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
    if (summaryData?.totals) return summaryData.totals;
    return summaries.reduce(
      (acc, item) => {
        const valuationValue =
          displayCurrency && typeof item.displayValue === "number"
            ? Number(item.displayValue)
            : Number(item.valuation ?? 0);
        if ((item.status ?? "ACTIVE") === "ARCHIVED") {
          acc.archived += valuationValue;
        }
        if (item.accountType === "LOAN") acc.liabilities += valuationValue;
        else acc.assets += valuationValue;
        acc.netWorth = acc.assets - acc.liabilities;
        return acc;
      },
      { assets: 0, liabilities: 0, archived: 0, netWorth: 0 },
    );
  }, [summaries, summaryData?.totals, displayCurrency]);
  const netWorth = totals.netWorth ?? totals.assets - totals.liabilities;
  const currencyCodes = useMemo(() => {
    const codes = new Set<string>();
    (accountList ?? []).forEach((account) => {
      if (account.baseCurrency) codes.add(account.baseCurrency.toUpperCase());
    });
    summaries.forEach((summary) => {
      if (summary.currency) codes.add(summary.currency.toUpperCase());
      if (summary.valuationCurrency) {
        codes.add(summary.valuationCurrency.toUpperCase());
      }
    });
    return Array.from(codes).sort();
  }, [accountList, summaries]);
  const totalsCurrency =
    summaryData?.displayCurrency ??
    displayCurrency ??
    summaries[0]?.currency ??
    "CNY";

  return (
    <PageContainer padding="md" testId="accounts-ui-page">
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-2" data-testid="accounts-ui-actions">
            <CreateAccountDialog />
            <TransferDialog />
            <ValuationFormDialog />
          </div>
        }
        description="快速浏览资产、负债与最新估值，支持一键入账与估值记录。"
        overline="Accounts"
        testId="accounts-ui-header"
        title="账户中心"
      />

      <AccountFxPanel
        currencies={currencyCodes}
        displayCurrency={displayCurrency ?? null}
      />

      <PageSection
        bleed
        contentClassName="bg-transparent p-0 shadow-none"
        testId="accounts-ui-summary"
      >
        <div className="grid gap-4 md:grid-cols-3">
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
                className="border border-border/60 bg-card/90"
                data-testid={`accounts-ui-summary-card-${card.key}`}
                key={card.key}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                    <span>{card.label}</span>
                    {badge ? (
                      <Badge className="text-xs" variant={badge.variant}>
                        {badge.label}
                      </Badge>
                    ) : null}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-foreground">
                    {formatAmount(
                      value,
                      totalsCurrency,
                    )}
                  </p>
                  {card.key === "assets" && totals.archived > 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      含已归档估值 {formatAmount(
                        totals.archived,
                        totalsCurrency,
                      )}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          汇总金额按展示币种 {totalsCurrency} 折算；下方账户卡片同时展示原币种与折算值。
        </p>
      </PageSection>

      {hasError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          加载账户数据失败，请稍后重试。
        </div>
      ) : null}

      <PageSection
        bleed
        contentClassName="border-none bg-transparent p-0 shadow-none"
        description="支持快捷操作与估值维护，按当前偏好币种展示。"
        testId="accounts-ui-table"
        title="账户列表"
      >
        <AccountTable
          accounts={accountList ?? []}
          displayCurrency={displayCurrency ?? null}
          isLoading={isLoading}
          summaries={summaries}
        />
      </PageSection>
    </PageContainer>
  );
}
