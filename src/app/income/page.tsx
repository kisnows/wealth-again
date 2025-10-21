"use client";

import {
  ArrowRightIcon,
  DatabaseIcon,
  HistoryIcon,
  LayersIcon,
  LayoutPanelLeftIcon,
  MedalIcon,
  PiggyBankIcon,
  RefreshCcwIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShieldCheckIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  BonusDialog,
  IncomeRecordsDialog,
  LongTermCashDialog,
  SalaryChangesDialog,
} from "@/components/modules/IncomeDialogs";
import IncomeAnalyticsPanel from "@/components/modules/IncomeAnalyticsPanel";
import IncomeEntryModule from "@/components/modules/IncomeEntryModule";
import IncomeForecastModule from "@/components/modules/IncomeForecastModule";
import {
  PageContainer,
  PageHeader,
  PageSection,
} from "@/components/modules/PageLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const MODAL_KEYS = ["records", "salary", "bonus", "ltc"] as const;
type ModalKey = (typeof MODAL_KEYS)[number];

const isModalKey = (value: string | null): value is ModalKey =>
  value !== null &&
  (MODAL_KEYS as readonly string[]).includes(value as ModalKey);

type QuickAction =
  | {
      id: ModalKey;
      mode: "modal";
      title: string;
      description: string;
      icon: ReactNode;
    }
  | {
      id: "rules" | "recalc";
      mode: "route";
      href: string;
      title: string;
      description: string;
      icon: ReactNode;
    };

const quickActions: QuickAction[] = [
  {
    id: "records",
    mode: "modal",
    title: "月度收入记录",
    description: "查看年度明细、执行人工调整与对账",
    icon: <ScrollTextIcon className="h-4 w-4" />,
  },
  {
    id: "recalc",
    mode: "route",
    href: "/income/recalc-status",
    title: "回算任务",
    description: "查看自动任务进度与手动回算入口",
    icon: <HistoryIcon className="h-4 w-4" />,
  },
  {
    id: "salary",
    mode: "modal",
    title: "工资变动",
    description: "维护工资记录，确保当前基数正确",
    icon: <LayoutPanelLeftIcon className="h-4 w-4" />,
  },
  {
    id: "bonus",
    mode: "modal",
    title: "一次性奖金",
    description: "配置奖金发放日与计税方式",
    icon: <MedalIcon className="h-4 w-4" />,
  },
  {
    id: "ltc",
    mode: "modal",
    title: "长期现金计划",
    description: "管理长期激励拆分与发放节奏",
    icon: <PiggyBankIcon className="h-4 w-4" />,
  },
  {
    id: "rules",
    mode: "route",
    href: "/rules/tax",
    title: "税务与专项扣除",
    description: "更新城市税制、专项附加扣除等配置",
    icon: <SettingsIcon className="h-4 w-4" />,
  },
];

export default function IncomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const dialogParam = searchParams.get("dialog");

  const [activeModal, setActiveModal] = useState<ModalKey | null>(null);

  useEffect(() => {
    if (isModalKey(dialogParam)) {
      setActiveModal(dialogParam);
    } else {
      setActiveModal(null);
    }
  }, [dialogParam]);

  const openModal = useCallback(
    (key: ModalKey) => {
      setActiveModal(key);
      const params = new URLSearchParams(searchParamsString);
      params.set("dialog", key);
      const query = params.toString();
      router.push(query ? `/income?${query}` : "/income", { scroll: false });
    },
    [router, searchParamsString],
  );

  const closeModal = useCallback(() => {
    setActiveModal(null);
    const params = new URLSearchParams(searchParamsString);
    params.delete("dialog");
    const query = params.toString();
    router.push(query ? `/income?${query}` : "/income", { scroll: false });
  }, [router, searchParamsString]);

  const actionButtons = useMemo(
    () => (
      <div className="flex flex-wrap gap-2" data-testid="income-ui-header-actions">
        <Button
          onClick={() => openModal("records")}
          size="sm"
          variant="default"
        >
          <ScrollTextIcon className="mr-2 h-4 w-4" />
          查看收入记录
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/income/recalc-status">
            <HistoryIcon className="mr-2 h-4 w-4" />
            回算任务
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/rules/tax">
            <LayersIcon className="mr-2 h-4 w-4" />
            规则维护
          </Link>
        </Button>
      </div>
    ),
    [openModal],
  );

  return (
    <PageContainer
      padding="md"
      testId="income-ui-page"
    >
      <PageHeader
        actions={actionButtons}
        description="统一维护工资、激励、社保、公积金与个税配置，所有展示均来自服务端实时回算结果。"
        meta={
          <Badge variant="outline" data-testid="income-ui-badge">
            Income
          </Badge>
        }
        overline="Income"
        testId="income-ui-header"
        title="收入管理中心"
      />

      <PageSection
        bleed
        contentClassName="border-none bg-transparent p-0 shadow-none"
        testId="income-ui-tabs"
        title="收入工作台"
        description="按概览、配置与预测拆分，支持模态框快捷操作。"
      >
        <Tabs
          className="space-y-6"
          data-testid="income-ui-tabs-root"
          defaultValue="overview"
        >
          <TabsList className="grid w-full gap-2 border border-border/60 bg-muted/60 p-1 md:w-[520px] md:grid-cols-3">
            <TabsTrigger
              data-testid="income-ui-tab-overview"
              value="overview"
            >
              概览
            </TabsTrigger>
            <TabsTrigger data-testid="income-ui-tab-entry" value="entry">
              配置与录入
            </TabsTrigger>
            <TabsTrigger
              data-testid="income-ui-tab-forecast"
              value="forecast"
            >
              收入预测
            </TabsTrigger>
          </TabsList>

          <TabsContent
            className="space-y-6"
            data-testid="income-ui-tabpanel-overview"
            value="overview"
          >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,2.6fr)_minmax(0,1.4fr)]">
              <section className="space-y-6" data-testid="income-ui-overview">
                <IncomeAnalyticsPanel
                  description="统一的收入统计面板，当前页面与报表均复用该组件，确保数据来源一致。"
                  showHeaderBadge
                  testIdPrefix="income"
                  title="收入概览"
                />
              </section>
              <aside className="space-y-4" data-testid="income-ui-overview-aside">
                <RealtimeSourceCard />
                <QuickActionsPanel onOpenModal={openModal} />
              </aside>
            </div>
          </TabsContent>

          <TabsContent
            data-testid="income-ui-tabpanel-entry"
            value="entry"
          >
            <IncomeEntryModule />
          </TabsContent>

          <TabsContent
            data-testid="income-ui-tabpanel-forecast"
            value="forecast"
          >
            <IncomeForecastModule />
          </TabsContent>
        </Tabs>
      </PageSection>

      {activeModal === "records" ? (
        <IncomeRecordsDialog onClose={closeModal} open />
      ) : null}
      {activeModal === "salary" ? (
        <SalaryChangesDialog onClose={closeModal} open />
      ) : null}
      {activeModal === "bonus" ? (
        <BonusDialog onClose={closeModal} open />
      ) : null}
      {activeModal === "ltc" ? (
        <LongTermCashDialog onClose={closeModal} open />
      ) : null}
    </PageContainer>
  );
}

function RealtimeSourceCard() {
  return (
    <Card data-testid="income-ui-realtime-source">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
          <ShieldCheckIcon className="h-5 w-5 text-primary" />
          单一实时来源
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>
          图表、概览与预测统一读取服务端回算后的
          <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs text-foreground/80">
            IncomeRecord
          </code>
          ，确保页面展示与导出结果一致。
        </p>
        <ul className="space-y-2 text-xs leading-relaxed">
          <li className="flex items-start gap-2">
            <RefreshCcwIcon className="mt-0.5 h-4 w-4 text-primary" />
            回算完成后自动失效 SWR 缓存，触发概览与预测刷新，无需手动同步。
          </li>
          <li className="flex items-start gap-2">
            <DatabaseIcon className="mt-0.5 h-4 w-4 text-primary" />
            所有写操作要求携带
            <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs text-foreground/80">
              Idempotency-Key
            </code>
            ，后端负责校验，避免重复提交。
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}

function QuickActionsPanel({
  onOpenModal,
}: {
  onOpenModal: (modal: ModalKey) => void;
}) {
  return (
    <Card data-testid="income-ui-quick-actions">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">
          快速操作
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {quickActions.map((action) => {
          const testId = `income-ui-quick-action-${action.id}`;
          const baseClasses =
            "group flex items-start justify-between gap-3 rounded-lg border border-border/60 px-3 py-3 text-left transition-colors";
          const hoverClasses =
            "hover:border-primary/40 hover:bg-primary/5 hover:text-foreground";
          return action.mode === "route" ? (
            <Link
              className={cn(baseClasses, hoverClasses)}
              data-testid={testId}
              href={action.href}
              key={action.id}
            >
              <ActionContent action={action} />
            </Link>
          ) : (
            <button
              className={cn(baseClasses, hoverClasses)}
              data-testid={testId}
              key={action.id}
              onClick={() => onOpenModal(action.id)}
              type="button"
            >
              <ActionContent action={action} />
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ActionContent({ action }: { action: QuickAction }) {
  return (
    <>
      <div className="flex items-start gap-3">
        <div className="mt-1 rounded-md bg-primary/10 p-2 text-primary">
          {action.icon}
        </div>
        <div>
          <div className="text-sm font-medium text-foreground">
            {action.title}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {action.description}
          </p>
        </div>
      </div>
      <ArrowRightIcon className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
    </>
  );
}
