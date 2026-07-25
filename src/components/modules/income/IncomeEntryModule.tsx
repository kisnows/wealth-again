"use client";

import {
  BanknoteIcon,
  CalendarIcon,
  PlusIcon,
  TrashIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { mutate } from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deleteBonus,
  deleteLTCPlan,
  deleteSalaryChange,
  useBonus,
  useLTCPlans,
  useSalaryChanges,
} from "@/lib/api/income";
import { formatMoney } from "@/lib/domain/money";
import { notifyAsync } from "@/lib/utils/notify";

export default function IncomeEntryModule() {
  return (
    <div className="space-y-6" data-testid="income-ui-entry-module">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            收入信息录入
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            管理工资变更、奖金和长期现金计划
          </p>
        </div>
      </div>

      {/* 平铺显示所有收入信息录入表单 */}
      <div className="space-y-6">
        <SalaryChangesSection />
        <BonusSection />
        <LongTermCashSection />
      </div>
    </div>
  );
}

// 工资变更记录组件
function SalaryChangesSection() {
  const { data, isLoading, error } = useSalaryChanges();
  const salaryChanges = data?.items ?? [];
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这条工资变更记录吗？删除后将影响收入计算结果。")) {
      return;
    }

    setDeletingId(id);
    try {
      await notifyAsync(() => deleteSalaryChange(id), {
        loading: "正在删除工资变更…",
        success: "工资变更记录已删除",
        error: (error) =>
          error instanceof Error && error.message ? error.message : "删除失败",
      });
      mutate("/api/v1/income-tax/salary-changes");
    } catch (error) {
      console.error("delete salary change error", error);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card data-testid="income-ui-entry-salary">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <WalletIcon className="h-5 w-5 text-primary" />
              工资变更记录
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              记录工资变更历史，当月生效，同月多次取最后一次
            </CardDescription>
          </div>
          <Link href="/income/salary-changes">
            <Button className="flex items-center gap-2" size="sm">
              <PlusIcon className="w-4 h-4" />
              新增变更
            </Button>
          </Link>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>生效日期</TableHead>
                <TableHead>月薪</TableHead>
                <TableHead>币种</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {["salary-1", "salary-2", "salary-3"].map((key) => (
                <TableRow key={key}>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-12 rounded" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-20" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : error ? (
          <div className="py-8 text-center text-sm text-destructive">
            加载失败
          </div>
        ) : salaryChanges.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            暂无工资变更记录
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>生效日期</TableHead>
                <TableHead>月薪</TableHead>
                <TableHead>币种</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salaryChanges.map((change, index) => (
                <TableRow key={change.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      {new Date(change.effectiveFrom).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatMoney(Number(change.grossMonthly), change.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{change.currency}</Badge>
                  </TableCell>
                  <TableCell>
                    {index === 0 ? (
                      <Badge className="bg-green-100 text-green-800">
                        当前
                      </Badge>
                    ) : (
                      <Badge variant="secondary">历史</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost">
                        编辑
                      </Button>
                      <Button
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        disabled={deletingId === change.id}
                        onClick={() => handleDelete(change.id)}
                        size="sm"
                        variant="ghost"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// 奖金记录组件
function BonusSection() {
  const { data, isLoading, error } = useBonus();
  const bonusPlans = data?.items ?? [];
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这条奖金记录吗？删除后将影响收入计算结果。")) {
      return;
    }

    setDeletingId(id);
    try {
      await notifyAsync(() => deleteBonus(id), {
        loading: "正在删除奖金记录…",
        success: "奖金记录已删除",
        error: (error) =>
          error instanceof Error && error.message ? error.message : "删除失败",
      });
      mutate("/api/v1/income-tax/bonus");
    } catch (error) {
      console.error("delete bonus error", error);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card data-testid="income-ui-entry-bonus">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <BanknoteIcon className="h-5 w-5 text-primary" />
              奖金记录
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              一次性奖金，与当月工资合并发放
            </CardDescription>
          </div>
          <Link href="/income/bonus">
            <Button className="flex items-center gap-2" size="sm">
              <PlusIcon className="w-4 h-4" />
              新增奖金
            </Button>
          </Link>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            加载中...
          </div>
        ) : error ? (
          <div className="py-8 text-center text-sm text-destructive">
            加载失败
          </div>
        ) : bonusPlans.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            暂无奖金记录
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>发放日期</TableHead>
                <TableHead>金额</TableHead>
                <TableHead>币种</TableHead>
                <TableHead>税务处理</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bonusPlans.map((bonus) => (
                <TableRow key={bonus.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      {new Date(bonus.effectiveDate).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatMoney(Number(bonus.amount), bonus.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{bonus.currency}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        bonus.taxMethod === "MERGE" ? "default" : "secondary"
                      }
                    >
                      {bonus.taxMethod === "MERGE" ? "合并计税" : "单独计税"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost">
                        编辑
                      </Button>
                      <Button
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={deletingId === bonus.id}
                        onClick={() => handleDelete(bonus.id)}
                        size="sm"
                        variant="ghost"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// 长期现金计划组件
function formatRecurrenceLabel(value: string) {
  switch (value) {
    case "MONTHLY":
      return "月度";
    case "QUARTERLY":
      return "季度";
    case "YEARLY":
      return "年度";
    case "CUSTOM":
      return "自定义";
    default:
      return value;
  }
}

function LongTermCashSection() {
  const { data, isLoading, error } = useLTCPlans();
  const ltcPlans = data?.items ?? [];
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "确定要删除这个长期现金计划吗？删除后将同时删除所有关联的支付记录。",
      )
    ) {
      return;
    }

    setDeletingId(id);
    try {
      await notifyAsync(() => deleteLTCPlan(id), {
        loading: "正在删除长期现金计划…",
        success: "长期现金计划已删除",
        error: (error) =>
          error instanceof Error && error.message ? error.message : "删除失败",
      });
      mutate("/api/v1/income-tax/ltc/plans");
    } catch (error) {
      console.error("delete ltc plan error", error);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card data-testid="income-ui-entry-ltc">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUpIcon className="h-5 w-5 text-primary" />
              长期现金计划
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              按季度分期发放的长期现金激励
            </CardDescription>
          </div>
          <Link href="/income/long-term-cash">
            <Button className="flex items-center gap-2" size="sm">
              <PlusIcon className="w-4 h-4" />
              新增计划
            </Button>
          </Link>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            加载中...
          </div>
        ) : error ? (
          <div className="py-8 text-center text-sm text-destructive">
            加载失败
          </div>
        ) : ltcPlans.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            暂无长期现金计划
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>计划名称</TableHead>
                <TableHead>总金额</TableHead>
                <TableHead>开始日期</TableHead>
                <TableHead>发放周期</TableHead>
                <TableHead>进度</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ltcPlans.map((plan) => {
                const vestCount = plan.vests?.length || 0;
                const totalPeriods = plan.periods;
                const progress =
                  totalPeriods > 0 ? (vestCount / totalPeriods) * 100 : 0;

                return (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">
                      LTC-{new Date(plan.startDate).getFullYear()}-
                      {String(new Date(plan.startDate).getMonth() + 1).padStart(
                        2,
                        "0",
                      )}
                    </TableCell>
                    <TableCell>
                      {formatMoney(Number(plan.totalAmount), plan.currency)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                        {new Date(plan.startDate).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {formatRecurrenceLabel(plan.recurrence)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {vestCount}/{totalPeriods}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost">
                          查看详情
                        </Button>
                        <Button size="sm" variant="ghost">
                          编辑
                        </Button>
                        <Button
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={deletingId === plan.id}
                          onClick={() => handleDelete(plan.id)}
                          size="sm"
                          variant="ghost"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
