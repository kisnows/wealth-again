"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createSalaryChange, createBonus, createLTCPlan, createEquityGrant, generateLTCPayouts, generateEquityVests } from "@/lib/api/income";
import { toast } from "sonner";

export function SalaryChangeForm() {
  const [form, setForm] = useState({ userId: "", grossMonthly: "", currency: "CNY", effectiveFrom: "" });
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createSalaryChange({ userId: form.userId, grossMonthly: Number(form.grossMonthly), currency: form.currency, effectiveFrom: new Date(form.effectiveFrom).toISOString() });
    toast.success("已创建工资变更");
  };
  return (
    <Card>
      <CardHeader><CardTitle>工资变更</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-2">
          <Label>用户</Label>
          <Input name="userId" value={form.userId} onChange={onChange} />
          <Label>税前月薪</Label>
          <Input name="grossMonthly" type="number" value={form.grossMonthly} onChange={onChange} />
          <Label>币种</Label>
          <Input name="currency" value={form.currency} onChange={onChange} />
          <Label>生效日期</Label>
          <Input name="effectiveFrom" type="date" value={form.effectiveFrom} onChange={onChange} />
          <Button type="submit" className="mt-2">创建</Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function BonusForm() {
  const [form, setForm] = useState({ userId: "", amount: "", currency: "CNY", effectiveDate: "" });
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createBonus({ userId: form.userId, amount: Number(form.amount), currency: form.currency, effectiveDate: new Date(form.effectiveDate).toISOString() });
    toast.success("已创建一次性奖金");
  };
  return (
    <Card>
      <CardHeader><CardTitle>一次性奖金</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-2">
          <Label>用户</Label>
          <Input name="userId" value={form.userId} onChange={onChange} />
          <Label>金额</Label>
          <Input name="amount" type="number" value={form.amount} onChange={onChange} />
          <Label>币种</Label>
          <Input name="currency" value={form.currency} onChange={onChange} />
          <Label>日期</Label>
          <Input name="effectiveDate" type="date" value={form.effectiveDate} onChange={onChange} />
          <Button type="submit" className="mt-2">创建</Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function LTCPlanForm() {
  const [form, setForm] = useState({ userId: "", totalAmount: "", currency: "CNY", startDate: "", periods: "", recurrence: "QUARTERLY" });
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const created = await createLTCPlan({ userId: form.userId, totalAmount: Number(form.totalAmount), currency: form.currency, startDate: new Date(form.startDate).toISOString(), periods: Number(form.periods), recurrence: form.recurrence });
    await generateLTCPayouts((created as any).id);
    toast.success("已创建并生成日程");
  };
  return (
    <Card>
      <CardHeader><CardTitle>长期现金计划</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-2">
          <Label>用户</Label>
          <Input name="userId" value={form.userId} onChange={onChange} />
          <Label>总金额</Label>
          <Input name="totalAmount" type="number" value={form.totalAmount} onChange={onChange} />
          <Label>币种</Label>
          <Input name="currency" value={form.currency} onChange={onChange} />
          <Label>开始日期</Label>
          <Input name="startDate" type="date" value={form.startDate} onChange={onChange} />
          <Label>期数</Label>
          <Input name="periods" type="number" value={form.periods} onChange={onChange} />
          <Label>频率</Label>
          <Input name="recurrence" value={form.recurrence} onChange={onChange} />
          <Button type="submit" className="mt-2">创建并生成</Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function EquityGrantForm() {
  const [form, setForm] = useState({ userId: "", totalUnits: "", currency: "CNY", startVestDate: "", vestPeriods: "", vestInterval: "YEARLY" });
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const created = await createEquityGrant({ userId: form.userId, totalUnits: Number(form.totalUnits), currency: form.currency, startVestDate: new Date(form.startVestDate).toISOString(), vestPeriods: Number(form.vestPeriods), vestInterval: form.vestInterval });
    await generateEquityVests((created as any).id);
    toast.success("已创建并生成归属");
  };
  return (
    <Card>
      <CardHeader><CardTitle>股权授予</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-2">
          <Label>用户</Label>
          <Input name="userId" value={form.userId} onChange={onChange} />
          <Label>总份额</Label>
          <Input name="totalUnits" type="number" value={form.totalUnits} onChange={onChange} />
          <Label>币种</Label>
          <Input name="currency" value={form.currency} onChange={onChange} />
          <Label>开始归属日</Label>
          <Input name="startVestDate" type="date" value={form.startVestDate} onChange={onChange} />
          <Label>归属期数</Label>
          <Input name="vestPeriods" type="number" value={form.vestPeriods} onChange={onChange} />
          <Label>归属频率</Label>
          <Input name="vestInterval" value={form.vestInterval} onChange={onChange} />
          <Button type="submit" className="mt-2">创建并生成</Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function IncomeForms() {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <SalaryChangeForm />
      <BonusForm />
      <LTCPlanForm />
      <EquityGrantForm />
    </div>
  );
}

