"use client";

import { useState } from "react";
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
import { type Account, createAccount, useAccounts } from "@/lib/api/accounts";
import { notifyAsync } from "@/lib/utils/notify";
import { getSupportedCurrencyOptions } from "@/lib/domain/currency";

type AccountTypeOption = Account["accountType"];

type AccountFormState = {
  name: string;
  accountType: AccountTypeOption;
  subType: string;
  customSubType: string;
  baseCurrency: string;
  initialBalance: string;
  description: string;
};

export default function CreateAccountDialog() {
  const [open, setOpen] = useState(false);
  const { data: accounts } = useAccounts();
  const subtypeOptions = Array.from(
    new Set((accounts ?? []).map((a) => a.subType).filter(Boolean)),
  ) as string[];
  const [form, setForm] = useState<AccountFormState>({
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
    try {
      await notifyAsync(
        () =>
          createAccount({
            name: form.name,
            accountType: form.accountType,
            baseCurrency: form.baseCurrency,
            subType:
              (form.subType === "__custom__"
                ? form.customSubType
                : form.subType) || undefined,
            description: form.description || undefined,
            initialBalance: form.initialBalance
              ? Number(form.initialBalance)
              : undefined,
          }),
        {
          loading: "正在创建账户…",
          success: "账户已创建",
          error: (error) =>
            error instanceof Error && error.message
              ? error.message
              : "创建失败，请稍后重试",
        },
      );
      setOpen(false);
    } catch (error) {
      // 已通过 notifyAsync 显示提示
      console.error("create account error", error);
    }
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
                {currencyOptions.map((option) => (
                  <SelectItem key={option.code} value={option.code}>
                    {option.label}
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
  const currencyOptions = getSupportedCurrencyOptions();
