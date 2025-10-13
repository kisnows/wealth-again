"use client";

import ReportsNav from "@/components/modules/ReportsNav";
import IncomeAnalyticsPanel from "@/components/modules/IncomeAnalyticsPanel";
import {
  PageContainer,
  PageHeader,
  PageSection,
} from "@/components/modules/PageLayout";
import { Badge } from "@/components/ui/badge";

export default function ReportsIncomePage() {
  return (
    <PageContainer padding="md" testId="reports-ui-income-page">
      <PageHeader
        description="复用收入工作台的同一套统计组件，按所选区间展示收入、扣除与税额，确保页面之间数据口径一致。"
        meta={
          <Badge variant="outline" data-testid="reports-ui-income-badge">
            Reports · Income
          </Badge>
        }
        overline="Reports"
        testId="reports-ui-income-header"
        title="收入报表"
      />

      <PageSection
        bleed
        contentClassName="border-none bg-transparent p-0 shadow-none"
        testId="reports-ui-income-nav"
        title="报表导航"
        description="选择报表类型后可快速切换到其他资产和税务视图。"
      >
        <ReportsNav />
      </PageSection>

      <PageSection
        testId="reports-ui-income-analytics"
        title="区间分析"
        description="所有指标皆由 IncomeAnalyticsPanel 提供，保持与收入中心概览完全一致。"
      >
        <IncomeAnalyticsPanel
          showHeaderBadge
          testIdPrefix="reports-income"
          title="收入趋势与结构"
        />
      </PageSection>
    </PageContainer>
  );
}
