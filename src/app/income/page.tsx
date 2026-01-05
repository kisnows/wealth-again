"use client";

import {
  DatabaseIcon,
  HistoryIcon,
  LayoutPanelLeftIcon,
  MedalIcon,
  PiggyBankIcon,
  RefreshCcwIcon,
  SettingsIcon,
  ShieldCheckIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import {
  BonusDialog,
  LongTermCashDialog,
  SalaryChangesDialog,
} from "@/components/modules/income/IncomeDialogs";
import IncomeAnalyticsPanel from "@/components/modules/income/IncomeAnalyticsPanel";
import { IncomeRecalcTaskBoard } from "@/components/modules/income/IncomeRecalcPanel";
import {
  PageContainer,
  PageHeader,
  PageSection,
} from "@/components/modules/layout/PageLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useUserPrefsStore } from "@/lib/state/identity";

/** 支持的弹窗类型标识 */
const MODAL_KEYS = ["salary", "bonus", "ltc"] as const;
type ModalKey = (typeof MODAL_KEYS)[number];

/**
 * 校验字符串是否为有效的弹窗类型
 * @param value - 待校验的字符串
 */
const isModalKey = (value: string | null): value is ModalKey =>
  value !== null &&
  (MODAL_KEYS as readonly string[]).includes(value as ModalKey);

/**
 * 收入管理中心页面组件
 *
 * 作为收入域的统一入口，提供：
 * - 核心配置入口：工资变更、一次性奖金、长期现金计划、税务规则
 * - 收入总览面板：展示收入、税费与扣除统计
 * - 回算任务中心：查看与触发回算任务
 *
 * 弹窗管理：
 * - 通过 URL 查询参数 `dialog` 控制弹窗状态
 * - 支持 salary（工资变更）、bonus（奖金）、ltc（长期现金）三种弹窗
 *
 * 数据来源：
 * - useUserPrefsStore: 用户偏好与任务状态
 * - IncomeAnalyticsPanel: 收入分析面板（内部管理数据）
 * - IncomeRecalcTaskBoard: 回算任务面板（内部管理数据）
 */
export default function IncomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const dialogParam = searchParams.get("dialog");
  const { pendingTasks, lastDataSyncAt } = useUserPrefsStore((state) => ({
    pendingTasks: state.pendingTasks,
    lastDataSyncAt: state.lastDataSyncAt,
  }));
  const syncLabel = formatRelativeTime(lastDataSyncAt);

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
    [router, searchParamsString]
  );

  const closeModal = useCallback(() => {
    setActiveModal(null);
    const params = new URLSearchParams(searchParamsString);
    params.delete("dialog");
    const query = params.toString();
    router.push(query ? `/income?${query}` : "/income", { scroll: false });
  }, [router, searchParamsString]);

  const actionButtons = (
    <div
      className="flex flex-wrap gap-2"
      data-testid="income-ui-header-actions"
    >
      <Button asChild size="sm" variant="outline">
        <Link href="#recalc">
          <HistoryIcon className="mr-2 h-4 w-4" />
          回算任务
        </Link>
      </Button>
      <Button asChild size="sm" variant="outline">
        <Link href="/rules/tax">
          <SettingsIcon className="mr-2 h-4 w-4" />
          规则维护
        </Link>
      </Button>
    </div>
  );

  return (
    <PageContainer padding="md" testId="income-ui-page">
      <PageHeader
        actions={actionButtons}
        description="统一维护工资、激励、社保、公积金与个税配置，所有展示均来自服务端实时回算结果。"
        meta={
          <div
            className="flex flex-wrap items-center gap-2"
            data-testid="income-ui-badge"
          >
            <Badge variant="outline">Income</Badge>
            <Badge
              data-testid="income-ui-recalc-status"
              variant={pendingTasks > 0 ? "secondary" : "default"}
            >
              {pendingTasks > 0 ? `回算待处理 ${pendingTasks}` : "回算队列已空"}
            </Badge>
            {syncLabel ? (
              <span
                className="text-xs text-muted-foreground"
                data-testid="income-ui-sync-label"
              >
                最近同步 {syncLabel}
              </span>
            ) : null}
          </div>
        }
        overline="Income"
        testId="income-ui-header"
        title="收入管理中心"
      />

      <div className="space-y-8">
        <div id="maintenance" className="scroll-mt-24">
          <PageSection
            data-testid="income-ui-maintenance-section"
            title="核心配置入口"
            description="常用维护入口集中在此处，便于快速录入或调整。"
          >
            <div
              className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
              data-testid="income-ui-maintenance-grid"
            >
              <MaintenanceItem
                actions={[
                  {
                    type: "button",
                    label: "新增工资变更",
                    onClick: () => openModal("salary"),
                  },
                ]}
                description="维护工资基数，同月多次变更自动取最新值。"
                icon={<LayoutPanelLeftIcon className="h-4 w-4 text-primary" />}
                testId="income-ui-maint-salary"
                title="工资变更管理"
              />
              <MaintenanceItem
                actions={[
                  {
                    type: "button",
                    label: "维护奖金",
                    onClick: () => openModal("bonus"),
                  },
                ]}
                description="配置一次性奖金的发放计划与计税方式。"
                icon={<MedalIcon className="h-4 w-4 text-primary" />}
                testId="income-ui-maint-bonus"
                title="一次性奖金"
              />
              <MaintenanceItem
                actions={[
                  {
                    type: "button",
                    label: "管理长期现金",
                    onClick: () => openModal("ltc"),
                  },
                  {
                    type: "link",
                    href: "/income/equity",
                    label: "股权激励",
                    variant: "ghost",
                  },
                ]}
                description="管理长期现金激励，自动生成季度/年度发放。"
                icon={<PiggyBankIcon className="h-4 w-4 text-primary" />}
                testId="income-ui-maint-ltc"
                title="长期现金计划"
              />
              <MaintenanceItem
                actions={[
                  {
                    type: "link",
                    href: "/rules/tax",
                    label: "前往规则维护",
                  },
                ]}
                description="更新城市社保、公积金与税率配置，保障计算准确。"
                icon={<SettingsIcon className="h-4 w-4 text-primary" />}
                testId="income-ui-maint-rules"
                title="税务与专项扣除"
              />
            </div>
            <RealtimeSourceSummary />
          </PageSection>
        </div>

        <div id="overview" className="scroll-mt-24">
          <PageSection
            data-testid="income-ui-overview-section"
            title="收入总览"
            description="最新收入、税费与扣除情况，一处掌握。"
          >
            <IncomeAnalyticsPanel
              showHeaderBadge
              testIdPrefix="income"
              title="收入概览"
              description="当前视图与报表共用同一数据源，保证统计口径一致。"
            />
          </PageSection>
        </div>

        <div id="recalc" className="scroll-mt-24">
          <PageSection
            data-testid="income-ui-recalc-section"
            title="回算任务中心"
            description="所有影响收入的变更都会自动排队回算，如需即时验证可在此触发。"
          >
            <IncomeRecalcTaskBoard />
          </PageSection>
        </div>
      </div>

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

/**
 * 格式化相对时间
 *
 * 将时间戳转换为人类可读的相对时间描述，如"刚刚"、"5 分钟前"等。
 *
 * @param timestamp - ISO 格式的时间戳字符串
 * @returns 格式化后的相对时间字符串，无效时返回 null
 */
function formatRelativeTime(timestamp: string | null) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  if (diffMs <= 0) return "刚刚";
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "刚刚";
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} 天前`;
}

/**
 * 实时数据来源说明组件
 *
 * 展示收入数据的单一来源说明，强调：
 * - 图表、时间线与回算面板统一读取服务端回算后的 IncomeRecord
 * - 回算完成后自动失效 SWR 缓存
 * - 所有写操作要求携带 Idempotency-Key
 */
function RealtimeSourceSummary() {
  return (
    <div
      className="flex flex-col gap-3 rounded-md border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground"
      data-testid="income-ui-realtime-source"
    >
      <div className="flex items-center gap-2 text-foreground">
        <ShieldCheckIcon className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">单一实时来源</span>
      </div>
      <p>
        图表、时间线与回算面板统一读取服务端回算后的
        <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs text-foreground/80">
          IncomeRecord
        </code>
        ，确保页面展示与导出结果一致。
      </p>
      <ul className="space-y-2 text-xs leading-relaxed">
        <li className="flex items-start gap-2">
          <RefreshCcwIcon className="mt-0.5 h-4 w-4 text-primary" />
          回算完成后自动失效 SWR 缓存，触发时间线刷新，无需手动同步。
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
    </div>
  );
}

/** 维护入口操作配置类型 */
type MaintenanceAction =
  | {
      type: "button";
      label: string;
      onClick: () => void;
      variant?: "default" | "outline" | "secondary" | "ghost";
    }
  | {
      type: "link";
      label: string;
      href: string;
      variant?: "default" | "outline" | "secondary" | "ghost";
    };

/**
 * 维护入口项组件
 *
 * 用于在核心配置入口区域展示单个维护项，包含：
 * - 图标与标题
 * - 功能描述
 * - 操作按钮（按钮或链接）
 *
 * @param icon - 图标元素
 * @param title - 标题
 * @param description - 功能描述
 * @param actions - 操作按钮配置列表
 * @param testId - 测试标识
 */
function MaintenanceItem({
  icon,
  title,
  description,
  actions,
  testId,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  actions: MaintenanceAction[];
  testId: string;
}) {
  return (
    <div
      className="grid gap-2 rounded-md border border-border/60 bg-card/60 p-3 text-sm md:grid-cols-[auto,1fr,auto] md:gap-3"
      data-testid={testId}
    >
      <div className="flex items-center gap-2 text-foreground">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </span>
        <span className="font-medium leading-tight">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground md:text-sm md:leading-tight">
        {description}
      </p>
      <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
        {actions.map((action) =>
          action.type === "button" ? (
            <Button
              key={action.label}
              onClick={action.onClick}
              size="sm"
              variant={action.variant ?? "outline"}
            >
              {action.label}
            </Button>
          ) : (
            <Button
              asChild
              key={action.label}
              size="sm"
              variant={action.variant ?? "outline"}
            >
              <Link href={action.href}>{action.label}</Link>
            </Button>
          )
        )}
      </div>
    </div>
  );
}
