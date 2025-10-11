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
import { type ReactNode, useCallback, useEffect, useState } from "react";
import {
  BonusDialog,
  IncomeRecalcDialog,
  IncomeRecordsDialog,
  LongTermCashDialog,
  SalaryChangesDialog,
} from "@/components/modules/IncomeDialogs";
import IncomeEntryModule from "@/components/modules/IncomeEntryModule";
import IncomeForecastModule from "@/components/modules/IncomeForecastModule";
import IncomeOverviewModule from "@/components/modules/IncomeOverviewModule";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MODAL_KEYS = ["records", "salary", "bonus", "ltc", "recalc"] as const;
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
      id: "rules";
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
    mode: "modal",
    title: "年度回算",
    description: "指定月份重新计算累计预扣个税",
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

  return (
    <main className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <Badge
            className="w-fit border-blue-200 text-blue-600"
            variant="outline"
          >
            Income
          </Badge>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">收入管理中心</h1>
            <p className="mt-1 text-sm text-gray-600">
              统一维护工资、激励、社保、公积金与个税配置，所有展示均来源于服务端实时回算结果。
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => openModal("records")}>
            <ScrollTextIcon className="mr-2 h-4 w-4" />
            查看收入记录
          </Button>
          <Button onClick={() => openModal("recalc")} variant="outline">
            <HistoryIcon className="mr-2 h-4 w-4" />
            年度回算
          </Button>
          <Button asChild variant="outline">
            <Link href="/rules/tax">
              <LayersIcon className="mr-2 h-4 w-4" />
              规则维护
            </Link>
          </Button>
        </div>
      </header>

      <Tabs className="space-y-6" defaultValue="overview">
        <TabsList className="grid w-full grid-cols-3 gap-2 lg:w-[480px]">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="entry">配置与录入</TabsTrigger>
          <TabsTrigger value="forecast">预测与回算</TabsTrigger>
        </TabsList>

        <TabsContent className="space-y-6" value="overview">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2.5fr)_minmax(0,1.2fr)] xl:grid-cols-[minmax(0,3fr)_minmax(0,1.3fr)]">
            <section className="space-y-6">
              <IncomeOverviewModule />
            </section>
            <aside className="space-y-4">
              <RealtimeSourceCard />
              <QuickActionsPanel onOpenModal={openModal} />
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="entry">
          <IncomeEntryModule />
        </TabsContent>

        <TabsContent value="forecast">
          <IncomeForecastModule />
        </TabsContent>
      </Tabs>

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
      {activeModal === "recalc" ? (
        <IncomeRecalcDialog onClose={closeModal} open />
      ) : null}
    </main>
  );
}

function RealtimeSourceCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <ShieldCheckIcon className="h-5 w-5 text-blue-600" />
          单一实时来源
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-gray-600">
        <p>
          图表、概览与预测统一读取服务端回算后的
          `IncomeRecord`，确保页面展示与导出结果一致。
        </p>
        <ul className="space-y-2 text-xs leading-relaxed">
          <li className="flex items-start gap-2">
            <RefreshCcwIcon className="mt-0.5 h-4 w-4 text-blue-500" />
            回算完成后自动失效 SWR 缓存，触发概览与预测刷新，无需手动同步。
          </li>
          <li className="flex items-start gap-2">
            <DatabaseIcon className="mt-0.5 h-4 w-4 text-blue-500" />
            所有写操作要求携带 `Idempotency-Key`，后端负责校验，避免重复提交。
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-gray-900">
          快速操作
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {quickActions.map((action) =>
          action.mode === "route" ? (
            <Link
              className="group flex items-start justify-between gap-3 rounded-lg border border-gray-200 px-3 py-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/40"
              href={action.href}
              key={action.id}
            >
              <ActionContent action={action} />
            </Link>
          ) : (
            <button
              className="group flex w-full items-start justify-between gap-3 rounded-lg border border-gray-200 px-3 py-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/40"
              key={action.id}
              onClick={() => onOpenModal(action.id)}
              type="button"
            >
              <ActionContent action={action} />
            </button>
          ),
        )}
      </CardContent>
    </Card>
  );
}

function ActionContent({ action }: { action: QuickAction }) {
  return (
    <>
      <div className="flex items-start gap-3">
        <div className="mt-1 rounded-md bg-blue-50 p-2 text-blue-600">
          {action.icon}
        </div>
        <div>
          <div className="text-sm font-medium text-gray-900">
            {action.title}
          </div>
          <p className="mt-1 text-xs text-gray-600">{action.description}</p>
        </div>
      </div>
      <ArrowRightIcon className="h-4 w-4 shrink-0 text-gray-400 transition-colors group-hover:text-blue-500" />
    </>
  );
}
