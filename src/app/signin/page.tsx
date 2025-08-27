"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function SignInPage() {
  const [form, setForm] = useState({ email: "demo@example.com", password: "demo" });
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await signIn("credentials", { email: form.email, password: form.password, redirect: true, callbackUrl: "/" });
    if ((res as any)?.error) toast.error((res as any).error);
  };
  return (
    <div className="flex items-center justify-center min-h-dvh">
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>登录</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-2">
            <Input name="email" placeholder="邮箱" value={form.email} onChange={onChange} />
            <Input name="password" type="password" placeholder="密码" value={form.password} onChange={onChange} />
            <Button type="submit" className="mt-2">登录</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

