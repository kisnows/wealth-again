"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createAccount, useAccounts } from "@/lib/api/accounts";

const SUPPORTED_CURRENCIES = ["CNY", "USD", "EUR", "HKD", "JPY", "GBP"];

export default function CreateAccountDialog() {
  const [open, setOpen] = useState(false);
  const { data: accounts } = useAccounts();
  const subtypeOptions = Array.from(
    new Set((accounts ?? []).map((a) => a.subType).filter(Boolean)),
  ) as string[];
  const [form, setForm] = useState({
    name: "",
    accountType: "SAVINGS",
    subType: "",
    customSubType: "",
    baseCurrency: "CNY",
    initialBalance: "",
    description: "",
  });
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createAccount({
      // userId从后端session中解析
      name: form.name,
      accountType: form.accountType as any,
      baseCurrency: form.baseCurrency,
      subType:
        (form.subType === "__custom__" ? form.customSubType : form.subType) ||
        undefined,
      description: form.description || undefined,
      initialBalance: form.initialBalance
        ? Number(form.initialBalance)
        : undefined,
    });
    toast.success("账户已创建");
    setOpen(false);
  };
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button>新建账户</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建账户</DialogTitle>
        </DialogHeader>
        <form className="grid gap-2" onSubmit={submit}>
          <div className="grid gap-1">
            <Label>名称</Label>
            <Input name="name" onChange={onChange} value={form.name} />
          </div>
          <div className="grid gap-1">
            <Label>类型</Label>
            <Select
              onValueChange={(v) => setForm((s) => ({ ...s, accountType: v }))}
              value={form.accountType}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SAVINGS">储蓄</SelectItem>
                <SelectItem value="INVESTMENT">投资</SelectItem>
                <SelectItem value="LOAN">借贷</SelectItem>
                <SelectItem value="OTHER">其他</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label>子类(可选)</Label>
            <Select
              onValueChange={(v) => setForm((s) => ({ ...s, subType: v }))}
              value={form.subType}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择子类或自定义" />
              </SelectTrigger>
              <SelectContent>
                {subtypeOptions.map((op) => (
                  <SelectItem key={op} value={op}>
                    {op}
                  </SelectItem>
                ))}
                <SelectItem value="__custom__">自定义…</SelectItem>
              </SelectContent>
            </Select>
            {form.subType === "__custom__" && (
              <Input
                className="mt-1"
                name="customSubType"
                onChange={onChange}
                placeholder="输入新的子类"
                value={form.customSubType}
              />
            )}
          </div>
          <div className="grid gap-1">
            <Label>币种</Label>
            <Select
              onValueChange={(v) => setForm((s) => ({ ...s, baseCurrency: v }))}
              value={form.baseCurrency}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择币种" />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_CURRENCIES.map((ccy) => (
                  <SelectItem key={ccy} value={ccy}>
                    {ccy}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label>初始余额(可选)</Label>
            <Input
              name="initialBalance"
              onChange={onChange}
              type="number"
              value={form.initialBalance}
            />
          </div>
          <div className="grid gap-1">
            <Label>描述(可选)</Label>
            <Input
              name="description"
              onChange={onChange}
              value={form.description}
            />
          </div>
          <DialogFooter>
            <Button type="submit">创建</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
