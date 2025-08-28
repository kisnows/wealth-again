"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { updateEquityVest } from "@/lib/api/income";

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
    await updateEquityVest(form.vestId, {
      fairValue: Number(form.fairValue),
      currency: form.currency,
    });
    toast.success("归属日 fairValue 已回填");
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>回填归属 fairValue</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-2">
          <Input
            name="vestId"
            placeholder="Vest ID"
            value={form.vestId}
            onChange={onChange}
          />
          <Input
            name="fairValue"
            type="number"
            placeholder="Fair Value"
            value={form.fairValue}
            onChange={onChange}
          />
          <Input
            name="currency"
            placeholder="CNY"
            value={form.currency}
            onChange={onChange}
          />
          <Button type="submit" className="mt-2">
            提交
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
