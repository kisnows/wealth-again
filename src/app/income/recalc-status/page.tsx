import { Suspense } from "react";
import { IncomeRecalcTaskBoard } from "@/components/modules/IncomeRecalcPanel";
import {
  PageContainer,
  PageHeader,
  PageSection,
} from "@/components/modules/PageLayout";
import { Badge } from "@/components/ui/badge";

export default function IncomeRecalcStatusPage() {
  return (
    <PageContainer padding="md" testId="income-ui-recalc-status-page">
      <PageHeader
        actions={null}
        description="系统会对工资、奖金、长期激励等变更自动排期回算，必要时可以在此触发立即回算。"
        meta={
          <Badge variant="outline" data-testid="income-ui-recalc-badge">
            Income · Recalc
          </Badge>
        }
        overline="Income"
        testId="income-ui-recalc-status-header"
        title="回算任务中心"
      />

      <PageSection
        description="自动任务最多聚合 10 分钟内的多次变更，避免重复计算。"
        testId="income-ui-recalc-section"
        title="任务队列与手动回算"
      >
        <Suspense
          fallback={
            <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/50 p-4 text-sm text-muted-foreground">
              加载回算任务中…
            </div>
          }
        >
          <IncomeRecalcTaskBoard />
        </Suspense>
      </PageSection>
    </PageContainer>
  );
}
