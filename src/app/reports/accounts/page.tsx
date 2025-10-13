"use client";

import ReportsNav from "@/components/modules/ReportsNav";
import {
  PageContainer,
  PageHeader,
  PageSection,
} from "@/components/modules/PageLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccountsSummary } from "@/lib/api/reports";
import { formatMoney } from "@/lib/domain/money";
import { useUserPrefsStore } from "@/lib/state/user-prefs";

export default function ReportsAccountsPage() {
  const { displayCurrency } = useUserPrefsStore();
  const { data, isLoading } = useAccountsSummary(displayCurrency ?? undefined);
  const items = data?.items ?? [];
  return (
    <PageContainer padding="md" testId="reports-ui-accounts-page">
      <PageHeader
        description="汇总查看各账户本金、估值表现，支持切换币种快速对比。"
        overline="Reports"
        testId="reports-ui-accounts-header"
        title="账户汇总"
      />

      <PageSection
        bleed
        contentClassName="border-none bg-transparent p-0 shadow-none"
        testId="reports-ui-accounts-nav"
      >
        <ReportsNav />
      </PageSection>

      <PageSection
        testId="reports-ui-accounts-table"
        title="账户估值一览"
        description="展示当前展示币种下的本金、估值与收益表现。"
      >
        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            加载中…
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>本金</TableHead>
                <TableHead>估值</TableHead>
                <TableHead>收益</TableHead>
                <TableHead>ROI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it: any) => (
                <TableRow data-testid="reports-ui-accounts-row" key={it.id}>
                  <TableCell className="font-medium text-foreground">
                    {it.name}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {formatMoney(it.principal, displayCurrency ?? it.currency)}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {formatMoney(
                      it.displayValue ?? it.valuation,
                      displayCurrency ?? it.currency,
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {formatMoney(it.profit, displayCurrency ?? it.currency)}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {it.roi == null ? "-" : `${(it.roi * 100).toFixed(2)}%`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </PageSection>
    </PageContainer>
  );
}
