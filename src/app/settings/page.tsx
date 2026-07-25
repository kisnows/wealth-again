"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Calculator, Calendar, MapPin, Settings2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import AnnualDeductionDialog from "@/components/modules/income/AnnualDeductionDialog";
import AccountFxPanel from "@/components/modules/fx/AccountFxPanel";
import CitySelect from "@/components/modules/identity/CitySelect";
import {
  PageContainer,
  PageHeader,
  PageSection,
} from "@/components/modules/layout/PageLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAnnualDeductions, type AnnualDeduction } from "@/lib/api/income";
import {
  type CityChangeItem,
  createCityChange,
  updateDisplayCurrency,
  useCityChanges,
  useCurrentUser,
} from "@/lib/api/user";
import { formatMoney } from "@/lib/domain/money";
import { useUserPrefsStore } from "@/lib/state/identity";
import { useAccountsSummary } from "@/lib/api/reports";
import {
  ensureSupportedCurrency,
  formatCurrencyLabel,
  getSupportedCurrencyOptions,
  resolveCountryCurrency,
  isSupportedCurrency,
} from "@/lib/domain/currency";
import { useLatestFxRates } from "@/lib/api/fx";

/** 国家代码到中文名称的映射 */
const countryLabels: Record<string, string> = {
  CN: "中国",
  US: "美国",
  UK: "英国",
  JP: "日本",
  SG: "新加坡",
  HK: "香港",
};

/** 城市迁移表单校验规则 */
const cityChangeSchema = z.object({
  toCityId: z.string().min(1, "请选择目标城市"),
  effectiveMonth: z.string().regex(/^\d{4}-\d{2}$/, "请选择生效月份"),
  reason: z
    .string()
    .max(120, "备注最多 120 个字符")
    .optional()
    .transform((val) => (val?.trim() ? val.trim() : undefined)),
});

type CityChangeFormValues = z.infer<typeof cityChangeSchema>;

/**
 * 获取下个月的年月值
 * @returns 格式为 "YYYY-MM" 的字符串
 */
function getNextMonthValue(): string {
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  );
  const month = String(next.getUTCMonth() + 1).padStart(2, "0");
  return `${next.getUTCFullYear()}-${month}`;
}

/**
 * 格式化月份显示标签
 * @param value - ISO 格式的日期字符串
 * @returns 格式如 "2024年01月" 的字符串
 */
function monthLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}年${month}月`;
}

/**
 * 构建城市显示名称
 * @param city - 城市对象，包含 name 和 country
 * @returns 格式如 "杭州（中国）" 的字符串
 */
function buildCityName(city?: { name: string; country: string } | null) {
  if (!city) return "尚未设置";
  const country = countryLabels[city.country] || city.country;
  return `${city.name}（${country}）`;
}

/**
 * 将月份值转换为 ISO 格式的月初日期
 * @param monthValue - 格式为 "YYYY-MM" 的字符串
 * @returns 格式为 "YYYY-MM-01" 的字符串
 */
function toIsoMonthStart(monthValue: string) {
  return `${monthValue}-01`;
}

/**
 * 查找最近的待生效城市迁移记录
 * @param items - 城市迁移记录列表
 * @returns 第一条尚未生效的迁移记录，若无则返回 undefined
 */
function findUpcomingChange(items: CityChangeItem[]) {
  const today = new Date();
  const monthStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)
  );
  const sorted = [...items].sort(
    (a, b) =>
      new Date(a.effectiveMonth).getTime() -
      new Date(b.effectiveMonth).getTime()
  );
  return sorted.find(
    (change) => new Date(change.effectiveMonth).getTime() > monthStart.getTime()
  );
}

/**
 * 从错误对象中提取可读的错误消息
 * @param error - 错误对象
 * @param fallback - 无法提取时的默认消息
 * @returns 可读的错误消息字符串
 */
function extractErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message) as { error?: unknown };
      if (parsed && typeof parsed.error === "string") {
        return parsed.error;
      }
    } catch (_err) {
      /* ignore json parse failures */
    }
    if (error.message) return error.message;
  }
  return fallback;
}

/**
 * 用户设置页面组件
 *
 * 提供用户个人偏好与配置的统一管理界面，包括：
 * - 展示偏好与基础设置：展示币种、当前工作城市、用户 ID
 * - 汇率维护：管理涉及币种的 USD 中间价
 * - 城市迁移：记录城市迁移计划，自动切换社保/公积金/个税规则
 * - 年度专项附加扣除：维护个税回算的年度扣除额度
 *
 * 数据来源：
 * - useCurrentUser: 当前用户信息
 * - useCityChanges: 城市迁移历史
 * - useAnnualDeductions: 年度专项附加扣除列表
 * - useAccountsSummary: 账户汇总（用于汇率面板币种列表）
 * - useLatestFxRates: 最新汇率（用于金额折算）
 */
export default function SettingsPage() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const {
    data: cityChangeData,
    isLoading: cityChangeLoading,
    error: cityChangeError,
  } = useCityChanges();
  const { data: accountsSummaryData } = useAccountsSummary();
  const {
    data: deductionData,
    isLoading: deductionLoading,
    error: deductionError,
  } = useAnnualDeductions();

  const [citySubmitting, setCitySubmitting] = useState(false);
  const [deductionDialogOpen, setDeductionDialogOpen] = useState(false);
  const [editingDeduction, setEditingDeduction] =
    useState<AnnualDeduction | null>(null);
  const { displayCurrency, setDisplayCurrency } = useUserPrefsStore();

  const fxCurrencies = useMemo(() => {
    const codes = new Set<string>();
    const addSupported = (code?: string | null) => {
      if (!code) return;
      if (!isSupportedCurrency(code)) return;
      codes.add(code.toUpperCase());
    };
    accountsSummaryData?.items.forEach((item) => {
      addSupported(item.currency);
      addSupported(item.valuationCurrency);
    });
    addSupported(displayCurrency);
    return Array.from(codes).sort();
  }, [accountsSummaryData?.items, displayCurrency]);

  const annualDeductions = deductionData?.items ?? [];
  const defaultEffectiveMonth = useMemo(() => getNextMonthValue(), []);
  const taxCurrencyCode = useMemo(
    () =>
      resolveCountryCurrency(cityChangeData?.currentCity?.country ?? undefined),
    [cityChangeData?.currentCity?.country]
  );
  const displayCurrencyCode = ensureSupportedCurrency(
    displayCurrency,
    taxCurrencyCode
  );
  const requiresConversion = displayCurrencyCode !== taxCurrencyCode;
  const supportedCurrencyOptions = useMemo(
    () => getSupportedCurrencyOptions(),
    []
  );
  const taxCurrencyLabel = useMemo(
    () => formatCurrencyLabel(taxCurrencyCode),
    [taxCurrencyCode]
  );
  const displayCurrencyLabel = useMemo(
    () => formatCurrencyLabel(displayCurrencyCode),
    [displayCurrencyCode]
  );

  const fxQuotes = useMemo(() => {
    if (!requiresConversion) return [];
    const quotes = new Set<string>();
    if (taxCurrencyCode !== "USD") quotes.add(taxCurrencyCode);
    if (displayCurrencyCode !== "USD") quotes.add(displayCurrencyCode);
    return Array.from(quotes);
  }, [requiresConversion, taxCurrencyCode, displayCurrencyCode]);

  const { data: latestFx } = useLatestFxRates(fxQuotes);

  const { convertAmount, conversionReady } = useMemo(() => {
    if (!requiresConversion) {
      return {
        convertAmount: (amount: number) => ({
          value: amount,
          displayCurrency: taxCurrencyCode,
          converted: false,
        }),
        conversionReady: true,
      };
    }
    const base = latestFx?.base?.toUpperCase() ?? "USD";
    const rateMap = new Map<string, number>();
    latestFx?.items?.forEach((item) => {
      if (item.rate != null) {
        rateMap.set(item.quote.toUpperCase(), Number(item.rate));
      }
    });
    const fromRate =
      taxCurrencyCode === base ? 1 : rateMap.get(taxCurrencyCode) ?? null;
    const toRate =
      displayCurrencyCode === base
        ? 1
        : rateMap.get(displayCurrencyCode) ?? null;
    if (!fromRate || !toRate) {
      return {
        convertAmount: (amount: number) => ({
          value: amount,
          displayCurrency: taxCurrencyCode,
          converted: false,
        }),
        conversionReady: false,
      };
    }
    return {
      convertAmount: (amount: number) => {
        const amountInBase =
          taxCurrencyCode === base ? amount : amount / fromRate;
        const converted =
          displayCurrencyCode === base ? amountInBase : amountInBase * toRate;
        return {
          value: converted,
          displayCurrency: displayCurrencyCode,
          converted: true,
        };
      },
      conversionReady: true,
    };
  }, [requiresConversion, latestFx, taxCurrencyCode, displayCurrencyCode]);

  const changeForm = useForm<CityChangeFormValues>({
    resolver: zodResolver(cityChangeSchema),
    defaultValues: {
      toCityId: "",
      effectiveMonth: defaultEffectiveMonth,
      reason: "",
    },
  });

  const upcomingChange = useMemo(
    () => findUpcomingChange(cityChangeData?.items ?? []),
    [cityChangeData?.items]
  );

  const applyDisplayCurrency = async (
    nextValue: string | null,
    successMessage: string
  ) => {
    const normalized =
      nextValue != null ? nextValue.trim().toUpperCase() : null;
    if (normalized === displayCurrency) return;
    const previous = displayCurrency ?? null;
    setDisplayCurrency(normalized);
    try {
      await updateDisplayCurrency(normalized);
      toast.success(successMessage);
    } catch (error) {
      setDisplayCurrency(previous);
      toast.error(extractErrorMessage(error, "展示币种更新失败，请稍后再试"));
    }
  };

  const handleDisplayCurrencyPreference = (nextValue: string) => {
    if (!nextValue) return;
    void applyDisplayCurrency(
      nextValue,
      `展示币种偏好已更新为 ${nextValue.toUpperCase()}`
    );
  };

  const onSubmitCityChange = async (values: CityChangeFormValues) => {
    setCitySubmitting(true);
    try {
      const result = await createCityChange({
        toCityId: values.toCityId,
        effectiveMonth: toIsoMonthStart(values.effectiveMonth),
        reason: values.reason,
      });
      const taskId = result?.task?.id;
      toast.success(
        taskId
          ? `城市迁移记录已创建，回算任务已排队（任务号 ${taskId}）`
          : "城市迁移记录已创建，回算任务已排队"
      );
      changeForm.reset({
        toCityId: "",
        effectiveMonth: values.effectiveMonth,
        reason: "",
      });
    } catch (error) {
      console.error("Create city change error:", error);
      toast.error(extractErrorMessage(error, "创建失败，请稍后再试"));
    } finally {
      setCitySubmitting(false);
    }
  };

  const handleOpenDeduction = (deduction?: AnnualDeduction | null) => {
    setEditingDeduction(deduction ?? null);
    setDeductionDialogOpen(true);
  };

  const handleDeductionDialogChange = (open: boolean) => {
    setDeductionDialogOpen(open);
    if (!open) {
      setEditingDeduction(null);
    }
  };

  if (userLoading || cityChangeLoading) {
    return (
      <PageContainer padding="md" testId="settings-ui-loading">
        <div className="space-y-4">
          <div className="h-8 w-40 animate-pulse rounded bg-muted" />
          <div className="h-32 animate-pulse rounded bg-muted" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer padding="md" testId="settings-ui-page">
      <PageHeader
        description="管理个人偏好、工作城市与专项附加扣除，保持收入回算口径一致。"
        overline="Settings"
        testId="settings-ui-header"
        title="用户设置"
      />

      <PageSection
        description="统一维护展示偏好、统计截止日期，并查看系统回算币种，其他页面仅作引用。"
        testId="settings-ui-section-profile"
        title="展示偏好与基础设置"
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <Card data-testid="settings-ui-preferences">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                展示偏好
              </CardTitle>
              <CardDescription>
                仅在此处设置展示币种，避免其他页面出现重复入口。
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="settings-pref-display">展示币种</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    data-testid="settings-ui-pref-display"
                    onValueChange={handleDisplayCurrencyPreference}
                    value={displayCurrency ?? undefined}
                  >
                    <SelectTrigger id="settings-pref-display">
                      <SelectValue placeholder="请选择展示币种" />
                    </SelectTrigger>
                    <SelectContent>
                      {supportedCurrencyOptions.map((option) => (
                        <SelectItem value={option.code} key={option.code}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    data-testid="settings-ui-pref-display-reset"
                    onClick={() => {
                      if (displayCurrency == null) return;
                      void applyDisplayCurrency(
                        null,
                        "展示币种偏好已恢复为自动模式"
                      );
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    恢复自动
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  选择具体币种后，账户与报表均按 USD
                  中间价折算；恢复自动则保留原币种。
                </p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="settings-ui-base">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                基础设置
              </CardTitle>
              <CardDescription>
                查看当前工作城市与用户标识，便于后续回算与导出操作。
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>当前工作城市</Label>
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  {buildCityName(cityChangeData?.currentCity)}
                </div>
                {upcomingChange && (
                  <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-3 text-xs text-primary">
                    {monthLabel(upcomingChange.effectiveMonth)} 将迁移至{" "}
                    {buildCityName(upcomingChange.toCity)}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>当前用户 ID</Label>
                <div className="flex items-center justify-between rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  <code className="break-all font-mono text-xs text-foreground/80">
                    {user?.id ?? "未获取到用户信息"}
                  </code>
                  <Button
                    disabled={!user?.id}
                    onClick={async () => {
                      if (!user?.id) return;
                      try {
                        await navigator.clipboard.writeText(user.id);
                        toast.success("用户 ID 已复制");
                      } catch (_error) {
                        toast.error("复制失败，请手动选择复制");
                      }
                    }}
                    size="sm"
                    variant="outline"
                  >
                    复制
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageSection>

      <PageSection
        description="统一维护涉及币种的 USD 中间价，更新后会刷新账户与报表展示。"
        testId="settings-ui-section-fx"
        title="汇率维护"
      >
        <AccountFxPanel
          currencies={fxCurrencies}
          testId="settings-ui-fx-panel"
        />
      </PageSection>

      <PageSection
        description="记录实际城市迁移计划，便于按生效月份切换社保、公积金与个税规则。"
        testId="settings-ui-section-city"
        title="城市迁移"
      >
        <Card data-testid="settings-ui-city-change">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              城市迁移
            </CardTitle>
            <CardDescription>
              提交迁移后，从生效月份起系统会按新城市的税务与社保规则回算收入
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Form {...changeForm}>
              <form
                className="grid gap-4 md:grid-cols-3"
                onSubmit={changeForm.handleSubmit(onSubmitCityChange)}
              >
                <FormField
                  control={changeForm.control}
                  name="toCityId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>目标城市</FormLabel>
                      <FormControl>
                        <CitySelect
                          disabled={citySubmitting}
                          onValueChange={field.onChange}
                          placeholder="选择迁移城市"
                          value={field.value}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={changeForm.control}
                  name="effectiveMonth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>生效月份</FormLabel>
                      <FormControl>
                        <Input
                          min={defaultEffectiveMonth}
                          type="month"
                          {...field}
                          disabled={citySubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={changeForm.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem className="md:col-span-1">
                      <FormLabel>备注（可选）</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="如：工作调动、搬家等"
                          {...field}
                          disabled={citySubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="md:col-span-3">
                  <Button
                    className="w-full md:w-auto"
                    disabled={citySubmitting}
                    type="submit"
                  >
                    {citySubmitting ? "提交中..." : "提交迁移"}
                  </Button>
                </div>
              </form>
            </Form>

            <div className="space-y-3">
              <h3 className="text-sm font-medium">历史记录</h3>
              {cityChangeError ? (
                <div className="flex items-center justify-center rounded-md border border-dashed border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
                  城市变更记录加载失败，请稍后重试
                </div>
              ) : (cityChangeData?.items.length ?? 0) === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  暂无迁移记录
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>生效月份</TableHead>
                      <TableHead>迁移前</TableHead>
                      <TableHead>迁移后</TableHead>
                      <TableHead>备注</TableHead>
                      <TableHead>提交时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cityChangeData?.items.map((change) => (
                      <TableRow key={change.id}>
                        <TableCell className="font-mono">
                          {monthLabel(change.effectiveMonth)}
                        </TableCell>
                        <TableCell>{buildCityName(change.fromCity)}</TableCell>
                        <TableCell>{buildCityName(change.toCity)}</TableCell>
                        <TableCell>{change.reason || "-"}</TableCell>
                        <TableCell>
                          {new Date(change.createdAt).toLocaleString("zh-CN", {
                            hour12: false,
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      </PageSection>

      <PageSection
        description="维护年度专项附加扣除额度，保证累计预扣与回算一致。"
        testId="settings-ui-section-deductions"
        title="年度专项附加扣除"
      >
        <Card data-testid="settings-ui-deductions">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  年度专项附加扣除
                </CardTitle>
                <CardDescription>
                  用于个税回算的年度专项附加扣除额度，系统会按月均摊。
                  {requiresConversion
                    ? conversionReady
                      ? ` 已按汇率折算为 ${displayCurrencyLabel}。`
                      : ` 尝试折算为 ${displayCurrencyLabel}，当前汇率加载中或不可用。`
                    : ` 金额单位：${taxCurrencyLabel}。`}
                </CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  asChild
                  data-testid="settings-ui-deductions-link-rules"
                  size="sm"
                  variant="outline"
                >
                  <Link href="/rules/tax">前往税务规则</Link>
                </Button>
                <Button
                  data-testid="settings-ui-deductions-new"
                  onClick={() => handleOpenDeduction(null)}
                  size="sm"
                >
                  新增专项扣除
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {deductionError ? (
              <div className="flex items-center justify-center py-6 text-destructive">
                数据加载失败，请稍后重试
              </div>
            ) : deductionLoading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                加载专项扣除数据...
              </div>
            ) : annualDeductions.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                <p className="mb-2 text-lg font-medium">暂无专项扣除记录</p>
                <p className="text-sm">
                  立即新增年度专项附加扣除，或前往规则中心检查税率配置。
                </p>
                <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                  <Button
                    data-testid="settings-ui-deductions-empty-create"
                    onClick={() => handleOpenDeduction(null)}
                  >
                    新增专项扣除
                  </Button>
                  <Button
                    asChild
                    data-testid="settings-ui-deductions-empty-rules"
                    variant="outline"
                  >
                    <Link href="/rules/tax">查看税务规则</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>税年</TableHead>
                    <TableHead className="text-right">年度额度</TableHead>
                    <TableHead className="text-right">月度均摊</TableHead>
                    <TableHead>分摊方式</TableHead>
                    <TableHead>备注</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {annualDeductions.map((deduction) => {
                    const annualConverted = convertAmount(
                      deduction.annualAmount
                    );
                    const monthlyConverted = convertAmount(
                      deduction.annualAmount / 12
                    );
                    const showOriginal =
                      requiresConversion && annualConverted.converted;
                    return (
                      <TableRow key={deduction.id}>
                        <TableCell>{deduction.taxYear}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatMoney(
                            annualConverted.value,
                            annualConverted.displayCurrency
                          )}
                          {requiresConversion ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {annualConverted.converted
                                ? `原币 ${formatMoney(
                                    deduction.annualAmount,
                                    taxCurrencyCode
                                  )}`
                                : conversionReady
                                ? `汇率不可用，已显示原币`
                                : `汇率加载中或缺失，暂显示原币`}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatMoney(
                            monthlyConverted.value,
                            monthlyConverted.displayCurrency
                          )}
                          {requiresConversion ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {monthlyConverted.converted
                                ? `原币 ${formatMoney(
                                    deduction.annualAmount / 12,
                                    taxCurrencyCode
                                  )}`
                                : conversionReady
                                ? `汇率不可用，已显示原币`
                                : `汇率加载中或缺失，暂显示原币`}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {deduction.allocationRule === "ONCE"
                            ? "一次性扣除"
                            : "平均分摊"}
                        </TableCell>
                        <TableCell>{deduction.note || "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            data-testid={`settings-ui-deduction-edit-${deduction.taxYear}`}
                            onClick={() => handleOpenDeduction(deduction)}
                            size="sm"
                            variant="outline"
                          >
                            编辑
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </PageSection>

      <AnnualDeductionDialog
        deduction={editingDeduction}
        currency={taxCurrencyCode}
        onOpenChange={handleDeductionDialogChange}
        onSuccess={() => {
          setEditingDeduction(null);
        }}
        open={deductionDialogOpen}
      />
    </PageContainer>
  );
}
