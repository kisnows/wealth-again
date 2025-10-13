"use client";

import { ArrowRightIcon, BarChart3Icon, PieChartIcon, WalletIcon } from "lucide-react";
import Link from "next/link";
import ReportsNav from "@/components/modules/ReportsNav";
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const REPORT_ENTRIES = [
  {
    href: "/reports/accounts",
    icon: <WalletIcon className="h-5 w-5 text-primary" />,
    title: "账户汇总",
    description: "按账户查看本金、估值与收益表现，支持切换展示币种。",
    testId: "reports-ui-landing-card-accounts",
    action: "查看账户报表",
  },
  {
    href: "/reports/income",
    icon: <BarChart3Icon className="h-5 w-5 text-emerald-600" />,
    title: "收入时序",
    description: "分析工资、奖金、股权等收入构成与趋势，支持时间区间筛选。",
    testId: "reports-ui-landing-card-income",
    action: "查看收入报表",
  },
];

export default function ReportsLandingPage() {
  return (
    <PageContainer padding="md" testId="reports-ui-landing-page">
      <PageHeader
        description="统一管理账户估值与收入趋势，快速跳转到具体报表模块。"
        meta={
          <Badge variant="outline" className="flex items-center gap-2">
            <PieChartIcon className="h-4 w-4" />
            报表中心
          </Badge>
        }
        overline="Reports"
        testId="reports-ui-landing-header"
        title="报表总览"
      />

      <PageSection
        bleed
        contentClassName="border-none bg-transparent p-0 shadow-none"
        testId="reports-ui-landing-nav"
      >
        <ReportsNav />
      </PageSection>

      <PageSection
        testId="reports-ui-landing-overview"
        title="可用报表"
        description="根据需要选择对应的报表模块，后续功能会在此持续补充。"
      >
        <div className="grid gap-4 md:grid-cols-2">
          {REPORT_ENTRIES.map((entry) => (
            <Card
              data-testid={entry.testId}
              key={entry.href}
              className="flex flex-col justify-between border border-border/60 transition hover:border-primary/60 hover:shadow-md"
            >
              <CardHeader className="space-y-3">
                <div className="flex items-center gap-3 text-muted-foreground">
                  {entry.icon}
                  <span className="text-sm font-medium uppercase tracking-wide text-primary">
                    模块
                  </span>
                </div>
                <CardTitle className="text-xl text-foreground">
                  {entry.title}
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  {entry.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  asChild
                  className="w-full justify-between"
                  data-testid={`${entry.testId}-action`}
                  variant="outline"
                >
                  <Link className="flex w-full items-center justify-between" href={entry.href}>
                    <span>{entry.action}</span>
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </PageSection>
    </PageContainer>
  );
}
