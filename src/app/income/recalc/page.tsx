"use client";

import { useState } from "react";
import { postIncomeRecalc } from "@/lib/api/income";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function IncomeRecalcPage() {
  const [form, setForm] = useState({ taxYear: "2025", endMonth: "8", cityId: "" });
  const submit = async () => {
    const res = await postIncomeRecalc({ taxYear: Number(form.taxYear), endMonth: Number(form.endMonth), cityId: form.cityId || undefined });
    toast.success(`已回算：${JSON.stringify(res)}`);
  };
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">年度累计回算</h1>
      <Card>
        <CardHeader><CardTitle>参数</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-2">
          <Input placeholder="Tax Year" type="number" value={form.taxYear} onChange={(e) => setForm({ ...form, taxYear: e.target.value })} />
          <Input placeholder="End Month (1-12)" type="number" value={form.endMonth} onChange={(e) => setForm({ ...form, endMonth: e.target.value })} />
          <Input placeholder="City ID (可选)" value={form.cityId} onChange={(e) => setForm({ ...form, cityId: e.target.value })} />
          <Button className="mt-2" onClick={submit}>开始回算</Button>
        </CardContent>
      </Card>
    </main>
  );
}

