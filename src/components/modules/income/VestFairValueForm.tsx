"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { updateEquityVest } from "@/lib/api/income";
import { notifyAsync } from "@/lib/utils/notify";

export default function VestFairValueForm() {
  const [form, setForm] = useState({
    vestId: "",
    fairValue: "",
    currency: "CNY",
  });
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vestId || !form.fairValue) {
      toast.error("请完整填写 Vest ID 和 Fair Value");
      return;
    }
    try {
      await notifyAsync(
        () =>
          updateEquityVest(form.vestId, {
            fairValue: Number(form.fairValue),
            currency: form.currency,
          }),
        {
          loading: "正在回填 fairValue…",
          success: "归属日 fairValue 已回填",
          error: (error) =>
            error instanceof Error && error.message
              ? error.message
              : "回填失败，请稍后重试",
        },
      );
    } catch (error) {
      console.error("update vest fair value error", error);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>回填归属 fairValue</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-2" onSubmit={submit}>
          <Input
            name="vestId"
            onChange={onChange}
            placeholder="Vest ID"
            value={form.vestId}
          />
          <Input
            name="fairValue"
            onChange={onChange}
            placeholder="Fair Value"
            type="number"
            value={form.fairValue}
          />
          <Input
            name="currency"
            onChange={onChange}
            placeholder="CNY"
            value={form.currency}
          />
          <Button className="mt-2" type="submit">
            提交
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
