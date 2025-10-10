"use client";

import { useMemo, useState } from "react";
import { Calendar, Calculator, MapPin } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import CitySelect from "@/components/modules/CitySelect";
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
  createCityChange,
  updateBaseCurrency,
  useCityChanges,
  useCurrentUser,
  type CityChangeItem,
} from "@/lib/api/user";
import { formatMoney } from "@/lib/domain/money";
import { toast } from "sonner";

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
  effectiveMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "请选择生效月份"),
  reason: z
    .string()
    .max(120, "备注最多 120 个字符")
    .optional()
    .transform((val) => (val?.trim() ? val.trim() : undefined)),
});

type CityChangeFormValues = z.infer<typeof cityChangeSchema>;

function getNextMonthValue(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
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
    (change) => new Date(change.effectiveMonth).getTime() > monthStart.getTime(),
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
  const {
    data: deductionData,
    isLoading: deductionLoading,
    error: deductionError,
  } = useAnnualDeductions();

  const [currencySaving, setCurrencySaving] = useState(false);
  const [citySubmitting, setCitySubmitting] = useState(false);

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

  const handleBaseCurrencyUpdate = async (currency: string) => {
    if (!user || currency === user.baseCurrency) return;
    setCurrencySaving(true);
    try {
      await updateBaseCurrency(currency);
      toast.success("基础币种已更新");
    } catch (error) {
      console.error("Update base currency error:", error);
      toast.error(extractErrorMessage(error, "更新失败，请稍后重试"));
    } finally {
      setCurrencySaving(false);
    }
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
      <main className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-40 rounded bg-muted" />
          <div className="h-32 rounded bg-muted" />
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">用户设置</h1>
        <p className="mt-1 text-muted-foreground">
          管理个人偏好、工作城市与专项附加扣除
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            基础设置
          </CardTitle>
          <CardDescription>调整展示币种，查看当前生效城市</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label>基础币种</Label>
            {user ? (
              <Select
                value={user.baseCurrency}
                onValueChange={handleBaseCurrencyUpdate}
                disabled={currencySaving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择基础币种" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CNY">人民币 (CNY)</SelectItem>
                  <SelectItem value="USD">美元 (USD)</SelectItem>
                  <SelectItem value="EUR">欧元 (EUR)</SelectItem>
                  <SelectItem value="HKD">港币 (HKD)</SelectItem>
                  <SelectItem value="JPY">日元 (JPY)</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Select disabled>
                <SelectTrigger>
                  <SelectValue placeholder="加载中..." />
                </SelectTrigger>
              </Select>
            )}
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
        </CardContent>
      </Card>

      <Card>
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
              onSubmit={changeForm.handleSubmit(onSubmitCityChange)}
              className="grid gap-4 md:grid-cols-3"
            >
              <FormField
                control={changeForm.control}
                name="toCityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>目标城市</FormLabel>
                    <FormControl>
                      <CitySelect
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="选择迁移城市"
                        disabled={citySubmitting}
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
                        type="month"
                        min={defaultEffectiveMonth}
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
                  type="submit"
                  className="w-full md:w-auto"
                  disabled={citySubmitting}
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

      <Card>
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
    </main>
  );
}
