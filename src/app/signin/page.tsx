"use client";

import { type SignInResponse, signIn } from "next-auth/react";
import Link from "next/link";
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

export default function SignInPage() {
  const [form, setForm] = useState({
    email: "demo@example.com",
    password: "demo",
  });
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res: SignInResponse | undefined = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: true,
      callbackUrl: "/",
    });
    if (res?.error) toast.error(res.error);
  };
  return (
    <div
      className="flex items-center justify-center min-h-dvh px-4"
      data-testid="identity-ui-signin-page"
    >
      <Card
        className="w-full max-w-sm"
        data-testid="identity-ui-signin-card"
      >
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
            >
              登录
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
