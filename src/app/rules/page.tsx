"use client";

import { Building2, Calculator, Landmark, ShieldCheck } from "lucide-react";
import Link from "next/link";
import {
  PageContainer,
  PageHeader,
  PageSection,
} from "@/components/modules/layout/PageLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** 规则配置入口列表：税制、社保、公积金、城市 */
const ruleEntries = [
  {
    href: "/rules/tax",
    title: "税制与税率",
    description: "维护各国税年、基本扣除额与阶梯税率，供累计预扣算法使用。",
    icon: Calculator,
  },
  {
    href: "/rules/social-security",
    title: "城市社保",
    description: "管理城市社保上下限、个人比例与固定医疗金额。",
    icon: ShieldCheck,
  },
  {
    href: "/rules/housing-fund",
    title: "住房公积金",
    description: "配置城市住房公积金基数区间与个人缴存比例。",
    icon: Building2,
  },
  {
    href: "/rules/cities",
    title: "城市名录",
    description: "新增或维护城市信息，并同步初始化税制规则。",
    icon: Landmark,
  },
];

/**
 * 规则中心概览页面组件
 *
 * 作为规则配置的统一入口，展示四大规则模块卡片：
 * - 税制与税率：各国税年、基本扣除额与阶梯税率
 * - 城市社保：社保上下限、个人比例与固定医疗金额
 * - 住房公积金：基数区间与个人缴存比例
 * - 城市名录：城市信息与税制规则初始化
 *
 * 每个卡片点击后跳转至对应的明细配置页面。
 */
export default function RulesOverviewPage() {
  return (
    <PageContainer padding="md" testId="rules-ui-overview">
      <PageHeader
        description="统一维护税务、社保、公积金与城市元数据，确保收入回算口径一致。"
        overline="Rules"
        testId="rules-ui-header"
        title="规则中心"
      />

      <PageSection
        bleed
        contentClassName="border-none bg-transparent p-0 shadow-none"
        testId="rules-ui-cards"
      >
        <div className="grid gap-4 md:grid-cols-2">
          {ruleEntries.map((entry) => (
            <Link href={entry.href} key={entry.href}>
              <Card className="transition hover:border-primary/60">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <entry.icon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{entry.title}</CardTitle>
                  </div>
                  <CardDescription>{entry.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-sm text-muted-foreground">
                    点击跳转至明细配置 →
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </PageSection>
    </PageContainer>
  );
}
