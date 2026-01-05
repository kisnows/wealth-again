"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import NetWorthLine from "@/components/modules/reporting/Charts/NetWorthLine";
import DepositDialog from "@/components/modules/accounts/DepositDialog";
import TransferDialog from "@/components/modules/accounts/TransferDialog";
import ValuationFormDialog from "@/components/modules/accounts/ValuationFormDialog";
import WithdrawDialog from "@/components/modules/accounts/WithdrawDialog";
import {
  PageContainer,
  PageHeader,
  PageSection,
} from "@/components/modules/layout/PageLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountTransactionsTable } from "@/components/modules/accounts/AccountTransactionsTable";
import { useAccountSummary, useAccountTimeseries } from "@/lib/api/accounts";
import { useAccountsSummary } from "@/lib/api/reports";
import { useUserPrefsStore } from "@/lib/state/identity";
import {
  formatMoney,
  formatPercent,
} from "@/components/modules/accounts/account-format";
import {
  ACCOUNT_TYPE_LABELS,
  STATUS_LABELS,
} from "@/components/modules/accounts/account-table-utils";

/**
 * 从账户汇总列表中查找指定账户的展示数据
 * @param accountId - 账户 ID
 * @param summaries - 账户汇总数据
 * @returns 匹配的账户汇总项，未找到返回 null
 */
function buildSummaryDisplay(
  accountId: string,
  summaries: ReturnType<typeof useAccountsSummary>["data"] | undefined,
) {
  if (!summaries?.items) return null;
  return summaries.items.find((item) => item.id === accountId) ?? null;
}

/**
 * 账户详情页面组件
 *
 * 展示单个账户的完整信息，包括：
 * - 核心指标卡片：当前估值、累计本金、收益、ROI
 * - 账户信息：类型、状态、账户币种、估值币种、描述
 * - 历史走势图：估值走势与本金走势折线图
 * - 交易记录表格：支持筛选与分页
 *
 * 已归档账户不显示操作按钮。
 *
 * 数据来源：
 * - useAccountSummary: 单账户汇总数据
 * - useAccountsSummary: 账户列表（用于展示币种折算）
 * - useAccountTimeseries: 账户时序数据（估值/本金）
 */
export default function AccountDetailPage() {
  const params = useParams<{ id: string }>();
  const accountId = params.id;
  const { displayCurrency } = useUserPrefsStore();

  const {
    data: summaryData,
    isLoading: summaryLoading,
    error: summaryError,
  } = useAccountSummary(accountId);
  const { data: summariesWithDisplay, isLoading: displaySummaryLoading } =
    useAccountsSummary(displayCurrency ?? undefined);
  const valuationSeries = useAccountTimeseries(accountId, "valuation");
  const principalSeries = useAccountTimeseries(accountId, "principal");

  const displaySummary = useMemo(
    () => buildSummaryDisplay(accountId, summariesWithDisplay),
    [accountId, summariesWithDisplay],
  );

  const isArchived = (summaryData?.status ?? "ACTIVE") === "ARCHIVED";
  const accountType = summaryData?.accountType ?? "SAVINGS";
  const valuationCurrency =
    summaryData?.valuationCurrency ?? summaryData?.currency ?? null;

  const valuationDisplayValue =
    displayCurrency &&
    typeof displaySummary?.displayValue === "number" &&
    Number.isFinite(displaySummary.displayValue)
      ? displaySummary.displayValue
      : (summaryData?.valuation ?? null);
  const principalDisplayValue =
    displayCurrency &&
    typeof displaySummary?.displayPrincipal === "number" &&
    Number.isFinite(displaySummary.displayPrincipal)
      ? displaySummary.displayPrincipal
      : (summaryData?.principal ?? null);
  const profitDisplayValue =
    displayCurrency &&
    typeof displaySummary?.displayProfit === "number" &&
    Number.isFinite(displaySummary.displayProfit)
      ? displaySummary.displayProfit
      : (summaryData?.profit ?? null);
  const cards = [
    {
      key: "valuation",
      label: "当前估值",
      value:
        valuationDisplayValue != null
          ? formatMoney(
              valuationDisplayValue,
              displayCurrency ??
                valuationCurrency ??
                summaryData?.currency ??
                "CNY",
            )
          : "—",
      detail:
        displayCurrency && summaryData
          ? `原币 ${formatMoney(summaryData.valuation ?? 0, valuationCurrency)}`
          : "",
    },
    {
      key: "principal",
      label: "累计本金",
      value:
        principalDisplayValue != null
          ? formatMoney(
              principalDisplayValue,
              displayCurrency ?? summaryData?.currency ?? "CNY",
            )
          : "—",
      detail:
        displayCurrency && summaryData
          ? `原币 ${formatMoney(summaryData.principal ?? 0, summaryData.currency)}`
          : "",
    },
    {
      key: "profit",
      label: "收益",
      value:
        profitDisplayValue != null
          ? formatMoney(
              profitDisplayValue,
              displayCurrency ?? summaryData?.currency ?? "CNY",
            )
          : "—",
      detail:
        displayCurrency && summaryData
          ? `原币 ${formatMoney(summaryData.profit ?? 0, summaryData.currency)}`
          : "",
    },
    {
      key: "roi",
      label: "ROI",
      value: formatPercent(summaryData?.roi ?? null),
      detail: "",
    },
  ];

  return (
    <PageContainer padding="md" testId="accounts-detail-page">
      <PageHeader
        actions={
          <div
            className="flex flex-wrap gap-2"
            data-testid="accounts-detail-actions"
          >
            {!isArchived ? (
              <>
                <DepositDialog defaultAccountId={accountId} />
                <WithdrawDialog defaultAccountId={accountId} />
                <TransferDialog defaultFromId={accountId} />
                {["INVESTMENT", "LOAN"].includes(accountType) ? (
                  <ValuationFormDialog defaultAccountId={accountId} />
                ) : null}
              </>
            ) : (
              <Badge variant="outline">账户已归档，无法新增交易</Badge>
            )}
          </div>
        }
        description="查看账户资产、历史走势与详细交易记录。"
        overline="Account Detail"
        testId="accounts-detail-header"
        title={summaryData?.name ?? "账户详情"}
      />

      <PageSection
        contentClassName="grid gap-4 md:grid-cols-4"
        testId="accounts-detail-summary"
        title="核心指标"
      >
        {(summaryLoading || displaySummaryLoading) && !summaryData ? (
          <>
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
          </>
        ) : (
          cards.map((card) => (
            <Card key={card.key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  {card.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-semibold text-foreground">
                  {card.value}
                </p>
                {card.detail ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {card.detail}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))
        )}
      </PageSection>

      <PageSection
        contentClassName="grid gap-4 md:grid-cols-2"
        description="账户元数据与状态信息。"
        testId="accounts-detail-meta"
        title="账户信息"
      >
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              基础信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">类型</span>
              <span className="font-medium">
                {ACCOUNT_TYPE_LABELS[accountType] ?? accountType}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">状态</span>
              <Badge variant={isArchived ? "outline" : "secondary"}>
                {STATUS_LABELS[summaryData?.status ?? "ACTIVE"] ??
                  summaryData?.status ??
                  "ACTIVE"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">账户币种</span>
              <span className="font-medium">
                {summaryData?.currency ?? "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">估值币种</span>
              <span className="font-medium">
                {valuationCurrency ?? summaryData?.currency ?? "—"}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              说明
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              {summaryData?.description
                ? summaryData.description
                : "该账户尚未填写描述。"}
            </p>
            <p className="text-xs text-muted-foreground">
              展示币种：{displayCurrency ?? "（跟随账户币种）"}
            </p>
          </CardContent>
        </Card>
      </PageSection>

      <PageSection
        contentClassName="grid gap-4 md:grid-cols-2"
        description="追踪估值与本金随时间的变化，评估历史走势。"
        testId="accounts-detail-charts"
        title="历史走势"
      >
        <Card data-testid="accounts-detail-chart-valuation">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              估值走势
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NetWorthLine
              data={(valuationSeries.data?.points ?? []).map((point) => ({
                x: String(point.asOf),
                y: Number(point.value),
              }))}
            />
          </CardContent>
        </Card>
        <Card data-testid="accounts-detail-chart-principal">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              本金走势
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NetWorthLine
              data={(principalSeries.data?.points ?? []).map((point) => ({
                x: String(point.asOf),
                y: Number(point.value),
              }))}
            />
          </CardContent>
        </Card>
      </PageSection>

      <PageSection
        description="支持多条件筛选、分页与导出，便于对账与追溯。"
        testId="accounts-detail-transactions-section"
        title="交易记录"
      >
        {summaryError ? (
          <div className="rounded border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            未找到该账户或无访问权限。
          </div>
        ) : (
          <AccountTransactionsTable
            accountCurrency={summaryData?.currency ?? "CNY"}
            accountId={accountId}
            displayCurrency={displayCurrency ?? null}
          />
        )}
      </PageSection>
    </PageContainer>
  );
}
