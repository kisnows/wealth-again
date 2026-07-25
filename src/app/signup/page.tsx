"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import useSWR from "swr";
import { toast } from "sonner";
import { registerUser, RegisterUserError } from "@/lib/api/auth";
import { formatCurrencyLabel } from "@/lib/domain/currency";
import { getJson } from "@/lib/utils/fetcher";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { z } from "zod";

/** 城市选项类型 */
type CityOption = {
  id: string;
  name: string;
  country: string;
};

/** 支持的展示币种代码列表 */
const DISPLAY_CURRENCY_CODES = ["CNY", "USD", "EUR", "HKD", "JPY"] as const;

/** 注册表单校验规则 */
const registerFormSchema = z
  .object({
    email: z.string().trim().min(1, "请输入邮箱").email("邮箱格式不正确"),
    name: z
      .string()
      .trim()
      .max(120, "姓名长度超出限制")
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined)),
    password: z
      .string()
      .min(8, "密码长度至少 8 位")
      .max(72, "密码长度不得超过 72 位"),
    confirmPassword: z.string().min(8, "请确认密码"),
    cityId: z.string().min(1, "请选择所在城市"),
    displayCurrency: z
      .string()
      .trim()
      .max(10, "展示币种无效")
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined)),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次输入的密码不一致",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerFormSchema>;

/** 展示币种选项列表（含格式化标签） */
const DISPLAY_CURRENCY_OPTIONS = DISPLAY_CURRENCY_CODES.map((code) => ({
  code,
  label: formatCurrencyLabel(code),
}));

/**
 * 注册页面组件
 *
 * 提供新用户注册功能，包括：
 * - 邮箱与密码设置（含确认密码校验）
 * - 姓名（可选）
 * - 所在城市选择（影响社保/公积金/个税规则）
 * - 展示币种偏好
 *
 * 注册流程：
 * 1. 调用 registerUser API 创建账户
 * 2. 注册成功后自动调用 authClient.signIn.email 登录
 * 3. 登录成功后重定向至首页
 *
 * 数据来源：
 * - /api/v1/identity/cities: 城市列表
 */
export default function SignUpPage() {
  const router = useRouter();
  const {
    data: cities,
    isLoading: citiesLoading,
    error: citiesError,
  } = useSWR<CityOption[]>("/api/v1/identity/cities", getJson);

  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      email: "",
      name: "",
      password: "",
      confirmPassword: "",
      cityId: "",
      displayCurrency: "CNY",
    },
  });

  const cityId = watch("cityId");

  useEffect(() => {
    if (!cities || cities.length === 0) return;
    if (!cityId) {
      setValue("cityId", cities[0].id);
    }
  }, [cities, cityId, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const normalizedEmail = values.email.trim().toLowerCase();
      await registerUser({
        email: normalizedEmail,
        password: values.password,
        name: values.name,
        cityId: values.cityId,
        displayCurrency: values.displayCurrency
          ? values.displayCurrency.toUpperCase()
          : null,
      });
      toast.success("注册成功，正在为您登录…");

      const signInResult = await authClient.signIn.email({
        email: normalizedEmail,
        password: values.password,
        callbackURL: "/",
      });

      if (signInResult.error) {
        router.push("/signin");
        toast.info("注册完成，请使用新账户登录");
        return;
      }

      if (signInResult.data?.redirect && signInResult.data.url) {
        router.replace(signInResult.data.url);
        return;
      }

      router.replace("/");
    } catch (error) {
      if (error instanceof RegisterUserError) {
        const code = error.code ?? "register_failed";
        const message = ERROR_MESSAGE_MAP[code] ?? "注册失败，请稍后重试";
        toast.error(message);
        if (code === "email_conflict") {
          setError("email", { message, type: "server" });
        }
        return;
      }
      toast.error("注册失败，请稍后重试");
    }
  });

  return (
    <div
      className="flex items-center justify-center min-h-dvh px-4"
      data-testid="identity-ui-register-page"
    >
      <Card className="w-full max-w-lg" data-testid="identity-ui-register-card">
        <CardHeader>
          <CardTitle>注册新账号</CardTitle>
          <CardDescription>创建账户以管理资产、收入与税务信息</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            data-testid="identity-ui-register-form"
            onSubmit={onSubmit}
          >
            <div className="grid gap-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                data-testid="identity-ui-register-email"
                placeholder="name@example.com"
                aria-invalid={Boolean(errors.email)}
                {...register("email")}
              />
              {errors.email?.message ? (
                <p className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name">姓名（可选）</Label>
              <Input
                id="name"
                data-testid="identity-ui-register-name"
                placeholder="请输入姓名"
                aria-invalid={Boolean(errors.name)}
                {...register("name")}
              />
              {errors.name?.message ? (
                <p className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                data-testid="identity-ui-register-password"
                type="password"
                placeholder="至少 8 位，建议包含字母与数字"
                aria-invalid={Boolean(errors.password)}
                {...register("password")}
              />
              {errors.password?.message ? (
                <p className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">确认密码</Label>
              <Input
                id="confirmPassword"
                data-testid="identity-ui-register-confirm-password"
                type="password"
                placeholder="请再次输入密码"
                aria-invalid={Boolean(errors.confirmPassword)}
                {...register("confirmPassword")}
              />
              {errors.confirmPassword?.message ? (
                <p className="text-sm text-destructive">
                  {errors.confirmPassword.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label>所在城市</Label>
              <Controller
                control={control}
                name="cityId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={citiesLoading || Boolean(citiesError)}
                  >
                    <SelectTrigger
                      data-testid="identity-ui-register-city"
                      aria-invalid={Boolean(errors.cityId)}
                      className="w-full justify-between"
                    >
                      <SelectValue placeholder="请选择所在城市" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities?.map((city) => (
                        <SelectItem key={city.id} value={city.id}>
                          {city.name}
                          <span className="text-muted-foreground text-xs">
                            {`（${city.country}）`}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.cityId?.message ? (
                <p className="text-sm text-destructive">
                  {errors.cityId.message}
                </p>
              ) : null}
              {citiesError ? (
                <p className="text-sm text-destructive">
                  城市列表加载失败，请稍后重试
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label>展示币种</Label>
              <Controller
                control={control}
                name="displayCurrency"
                render={({ field }) => (
                  <Select
                    value={field.value ?? undefined}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger
                      data-testid="identity-ui-register-display-currency"
                      className="w-full justify-between"
                    >
                      <SelectValue placeholder="请选择展示币种" />
                    </SelectTrigger>
                    <SelectContent>
                      {DISPLAY_CURRENCY_OPTIONS.map((option) => (
                        <SelectItem key={option.code} value={option.code}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.displayCurrency?.message ? (
                <p className="text-sm text-destructive">
                  {errors.displayCurrency.message}
                </p>
              ) : null}
            </div>

            <Button
              data-testid="identity-ui-register-submit"
              type="submit"
              className="w-full"
              disabled={isSubmitting || citiesLoading}
            >
              {isSubmitting ? "注册中…" : "注册并登录"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-between text-sm text-muted-foreground">
          <span>已有账号？</span>
          <Link
            className="text-primary underline-offset-4 hover:underline"
            data-testid="identity-ui-register-to-signin"
            href="/signin"
          >
            前往登录
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}

/** 注册错误码到中文消息的映射 */
const ERROR_MESSAGE_MAP: Record<string, string> = {
  email_conflict: "该邮箱已注册，请直接登录",
  city_not_found: "选择的城市无效，请重新选择",
  display_currency_not_supported: "展示币种暂不支持该选项",
  validation_failed: "输入信息校验失败，请检查后重试",
  "Idempotency key reused": "请求重复，请稍后重试",
};
