"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";

/**
 * 登录页面组件
 *
 * 提供用户邮箱密码登录功能：
 * - 默认预填测试账号（demo@example.com / demo）
 * - 登录成功后重定向至首页或指定回调地址
 * - 登录失败时展示错误提示
 *
 * 认证流程：
 * - 调用 authClient.signIn.email 完成 better-auth 认证
 * - 支持服务端重定向响应
 */
export default function SignInPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "demo@example.com",
    password: "demo",
  });
  const [submitting, setSubmitting] = useState(false);
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await authClient.signIn.email({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        callbackURL: "/",
      });
      if (result.error) {
        toast.error(result.error.message || "登录失败，请稍后重试");
        return;
      }
      if (result.data?.redirect && result.data.url) {
        router.replace(result.data.url);
        return;
      }
      router.replace("/");
    } catch (error) {
      console.error("sign in failed", error);
      toast.error("登录失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div
      className="flex items-center justify-center min-h-dvh px-4"
      data-testid="identity-ui-signin-page"
    >
      <Card className="w-full max-w-sm" data-testid="identity-ui-signin-card">
        <CardHeader>
          <CardTitle>登录</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-2"
            data-testid="identity-ui-signin-form"
            onSubmit={submit}
          >
            <Input
              name="email"
              onChange={onChange}
              placeholder="邮箱"
              data-testid="identity-ui-signin-email"
              value={form.email}
            />
            <Input
              name="password"
              onChange={onChange}
              placeholder="密码"
              type="password"
              data-testid="identity-ui-signin-password"
              value={form.password}
            />
            <Button
              className="mt-2"
              data-testid="identity-ui-signin-submit"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "正在登录…" : "登录"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-between text-sm text-muted-foreground">
          <span>还没有账号？</span>
          <Link
            className="text-primary underline-offset-4 hover:underline"
            data-testid="identity-ui-signin-to-signup"
            href="/signup"
          >
            立即注册
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
