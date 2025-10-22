"use client";

import Link from "next/link";
import { useMemo } from "react";
import AccountTable from "@/components/modules/AccountTable";
import CreateAccountDialog from "@/components/modules/CreateAccountDialog";
import DepositDialog from "@/components/modules/DepositDialog";
import TransferDialog from "@/components/modules/TransferDialog";
import ValuationFormDialog from "@/components/modules/ValuationFormDialog";
import WithdrawDialog from "@/components/modules/WithdrawDialog";
import { AccountsSummaryTable } from "@/components/modules/accounts/AccountsSummaryTable";
import {
  PageContainer,
  PageHeader,
  PageSection,
} from "@/components/modules/PageLayout";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAccounts } from "@/lib/api/accounts";
import { useAccountsSummary } from "@/lib/api/reports";
import { useUserPrefsStore } from "@/lib/state/user-prefs";

const SUMMARY_CARDS = [
  { key: "assets", label: "资产总额", badge: { label: "资产", variant: "secondary" as const } },
  { key: "liabilities", label: "负债总额", badge: { label: "负债", variant: "outline" as const } },
  { key: "net", label: "净资产", badge: { label: "净值", variant: "default" as const } },
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
  const totalsCurrency =
    summaryData?.displayCurrency ??
    displayCurrency ??
    summaries[0]?.currency ??
    "CNY";

  return (
    <PageContainer padding="md" testId="accounts-ui-page">
      <PageHeader
        actions={
          <div className="flex flex-wrap items-center gap-2" data-testid="accounts-ui-actions">
            <div data-testid="accounts-ui-action-create">
              <CreateAccountDialog />
            </div>
            <div data-testid="accounts-ui-action-deposit">
              <DepositDialog />
            </div>
            <div data-testid="accounts-ui-action-withdraw">
              <WithdrawDialog />
            </div>
            <div data-testid="accounts-ui-action-transfer">
              <TransferDialog />
            </div>
            <div data-testid="accounts-ui-action-valuation">
              <ValuationFormDialog />
            </div>
            <Button
              asChild
              data-testid="accounts-ui-action-settings"
              size="sm"
              variant="outline"
            >
              <Link href="/settings">
                管理全局设置
              </Link>
            </Button>
          </div>
        }
        description="快速浏览资产、负债与最新估值，支持一键入账与估值记录。"
        overline="Accounts"
        testId="accounts-ui-header"
        title="账户中心"
      />

      <PageSection
        bleed
        className="border-none bg-transparent shadow-none"
        contentClassName="border-none bg-transparent p-0 shadow-none"
        description="快速浏览核心指标与账户估值细节，所有金额按当前展示币种折算。"
        testId="accounts-ui-overview"
        title="账户概览"
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,380px)_minmax(0,1.35fr)]">
          <Card className="h-full border-border/70 bg-card/95 shadow-sm" data-testid="accounts-ui-summary-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold text-foreground">
                关键指标
              </CardTitle>
              <CardDescription className="text-xs">
                汇总金额按 {totalsCurrency} 折算，实时基于最新估值。
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <dl className="divide-y divide-border/60">
                {SUMMARY_CARDS.map((card) => {
                  const value =
                    card.key === "assets"
                      ? totals.assets
                      : card.key === "liabilities"
                        ? totals.liabilities
                        : netWorth;
                  return (
                    <div
                      className="flex items-center justify-between gap-3 px-4 py-3"
                      data-testid={`accounts-ui-summary-card-${card.key}`}
                      key={card.key}
                    >
                      <div className="space-y-1">
                        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                          {card.label}
                        </dt>
                        <dd className="text-xl font-semibold leading-tight text-foreground">
                          {formatAmount(value, totalsCurrency)}
                        </dd>
                      </div>
                      {card.badge ? (
                        <Badge className="text-[11px]" variant={card.badge.variant}>
                          {card.badge.label}
                        </Badge>
                      ) : null}
                    </div>
                  );
                })}
              </dl>
            </CardContent>
            {totals.archived > 0 ? (
              <CardFooter className="border-t border-border/60 px-4 py-2">
                <p className="text-xs text-muted-foreground">
                  含已归档估值 {formatAmount(totals.archived, totalsCurrency)}
                </p>
              </CardFooter>
            ) : null}
          </Card>

          <Card
            className="h-full border-border/70 bg-card/95 shadow-sm"
            data-testid="accounts-ui-summary-table-card"
          >
            <CardHeader className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-foreground">
                  账户估值一览
                </CardTitle>
                <CardDescription className="text-xs">
                  按本金、估值、收益与 ROI 对比主要账户，支持悬停查看原币种。
                </CardDescription>
              </div>
              <Badge variant="outline">展示币种: {totalsCurrency}</Badge>
            </CardHeader>
            <CardContent className="overflow-x-auto px-0">
              <AccountsSummaryTable
                displayCurrency={displayCurrency ?? null}
                isLoading={loadingSummary}
                items={summaries}
              />
            </CardContent>
          </Card>
        </div>
      </PageSection>

      {hasError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          加载账户数据失败，请稍后重试。
        </div>
      ) : null}

      <PageSection
        bleed
        className="border-none bg-transparent shadow-none"
        contentClassName="border-none bg-transparent p-0 shadow-none"
        description="支持过滤、快捷操作与估值维护，列表按当前展示币种折算并保留原币种信息。"
        testId="accounts-ui-table"
        title="账户详情"
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
