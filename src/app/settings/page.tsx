"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Calculator, Calendar, MapPin, Settings2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import AccountFxPanel from "@/components/modules/AccountFxPanel";
import CitySelect from "@/components/modules/CitySelect";
import {
  PageContainer,
  PageHeader,
  PageSection,
} from "@/components/modules/PageLayout";
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
import { useAnnualDeductions } from "@/lib/api/income";
import {
  type CityChangeItem,
  createCityChange,
  updateDisplayCurrency,
  useCityChanges,
  useCurrentUser,
} from "@/lib/api/user";
import { formatMoney } from "@/lib/domain/money";
import { useUserPrefsStore } from "@/lib/state/user-prefs";
import { useAccountsSummary } from "@/lib/api/reports";

const countryLabels: Record<string, string> = {
  CN: "中国",
  US: "美国",
  UK: "英国",
  JP: "日本",
  SG: "新加坡",
  HK: "香港",
};

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

function getNextMonthValue(): string {
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  const month = String(next.getUTCMonth() + 1).padStart(2, "0");
  return `${next.getUTCFullYear()}-${month}`;
}

function monthLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}年${month}月`;
}

function buildCityName(city?: { name: string; country: string } | null) {
  if (!city) return "尚未设置";
  const country = countryLabels[city.country] || city.country;
  return `${city.name}（${country}）`;
}

function toIsoMonthStart(monthValue: string) {
  return `${monthValue}-01`;
}

function findUpcomingChange(items: CityChangeItem[]) {
  const today = new Date();
  const monthStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
  );
  const sorted = [...items].sort(
    (a, b) =>
      new Date(a.effectiveMonth).getTime() -
      new Date(b.effectiveMonth).getTime(),
  );
  return sorted.find(
    (change) =>
      new Date(change.effectiveMonth).getTime() > monthStart.getTime(),
  );
}

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
  const {
    displayCurrency,
    asOfDate,
    setDisplayCurrency,
    setAsOfDate,
  } = useUserPrefsStore();

  const fxCurrencies = useMemo(() => {
    const codes = new Set<string>();
    const addCode = (code?: string | null) => {
      if (!code) return;
      const upper = code.toUpperCase();
      if (upper.length === 0) return;
      codes.add(upper);
    };
    accountsSummaryData?.items.forEach((item) => {
      addCode(item.currency);
      addCode(item.valuationCurrency);
    });
    addCode(user?.baseCurrency);
    addCode(displayCurrency ?? undefined);
    return Array.from(codes).sort();
  }, [accountsSummaryData?.items, user?.baseCurrency, displayCurrency]);

  const annualDeductions = deductionData?.items ?? [];
  const defaultEffectiveMonth = useMemo(() => getNextMonthValue(), []);

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
    [cityChangeData?.items],
  );

  const applyDisplayCurrency = async (
    nextValue: string | null,
    successMessage: string,
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
      `展示币种偏好已更新为 ${nextValue.toUpperCase()}`,
    );
  };

  const handleAsOfDateUpdate = (value: string) => {
    const trimmed = (value ?? "").trim();
    const normalized = trimmed ? trimmed : null;
    if (normalized === asOfDate) return;
    setAsOfDate(normalized);
    toast.success(
      normalized ? `统计日期已更新至 ${trimmed}` : "统计日期偏好已清除",
    );
  };

  const onSubmitCityChange = async (values: CityChangeFormValues) => {
    setCitySubmitting(true);
    try {
      await createCityChange({
        toCityId: values.toCityId,
        effectiveMonth: toIsoMonthStart(values.effectiveMonth),
        reason: values.reason,
      });
      toast.success("城市迁移记录已创建，将于生效月份起应用新规则");
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
                仅在此处设置展示币种与统计日期，避免其他页面出现重复入口。
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
                      <SelectItem value="CNY">人民币 (CNY)</SelectItem>
                      <SelectItem value="USD">美元 (USD)</SelectItem>
                      <SelectItem value="EUR">欧元 (EUR)</SelectItem>
                      <SelectItem value="HKD">港币 (HKD)</SelectItem>
                      <SelectItem value="JPY">日元 (JPY)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    data-testid="settings-ui-pref-display-reset"
                    onClick={() => {
                      if (displayCurrency == null) return;
                      void applyDisplayCurrency(
                        null,
                        "展示币种偏好已恢复为自动模式",
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
                  选择具体币种后，账户与报表均按 USD 中间价折算；恢复自动则保留原币种。
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="settings-pref-asof">统计日期（As-of）</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    className="w-full md:max-w-[220px]"
                    data-testid="settings-ui-pref-asof"
                    id="settings-pref-asof"
                    onChange={(event) => handleAsOfDateUpdate(event.target.value)}
                    type="date"
                    value={asOfDate ?? ""}
                  />
                  {asOfDate ? (
                    <Button
                      data-testid="settings-ui-pref-asof-clear"
                      onClick={() => handleAsOfDateUpdate("")}
                      size="sm"
                      variant="outline"
                    >
                      清除日期
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  用于 Dashboard 与报表聚合的统计截止日期，留空时以最新数据为准。
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
                管理当前工作城市，并查看系统统一使用的回算币种与用户标识。
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>系统回算币种</Label>
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  {user?.baseCurrency ?? "CNY"}
                </div>
                <p className="text-xs text-muted-foreground">
                  当前收入、社保、公积金等回算均使用该币种折算，暂不支持按历史阶段切换。如需变更，请联系管理员或等待多币种口径支持。
                </p>
              </div>
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
        <AccountFxPanel currencies={fxCurrencies} testId="settings-ui-fx-panel" />
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
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              年度专项附加扣除
            </CardTitle>
            <CardDescription>
              用于个税回算的年度专项附加扣除额度，系统会按月均摊
            </CardDescription>
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
                  请联系管理员或在导入流程中补充年度专项附加扣除。
                </p>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {annualDeductions.map((deduction) => {
                    const monthly = deduction.annualAmount / 12;
                    return (
                      <TableRow key={deduction.id}>
                        <TableCell>{deduction.taxYear}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatMoney(
                            deduction.annualAmount,
                            user?.baseCurrency || "CNY",
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatMoney(monthly, user?.baseCurrency || "CNY")}
                        </TableCell>
                        <TableCell>
                          {deduction.allocationRule === "ONCE"
                            ? "一次性扣除"
                            : "平均分摊"}
                        </TableCell>
                        <TableCell>{deduction.note || "-"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </PageSection>
    </PageContainer>
  );
}
