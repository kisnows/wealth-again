"use client";

import { useEffect, useMemo, useState } from "react";
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
import { postWithdraw, useAccounts, type Account } from "@/lib/api/accounts";
import { toInputDatetimeValue } from "@/lib/utils/datetime";

export default function WithdrawDialog({
  defaultAccountId,
  onSuccess,
}: {
  defaultAccountId?: string;
  onSuccess?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { data: accounts, isLoading } = useAccounts();
  const buildInitialForm = () => ({
    accountId: defaultAccountId ?? "",
    amount: "",
    occurredAt: toInputDatetimeValue(new Date()),
    note: "",
  });
  const [form, setForm] = useState(buildInitialForm);
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
  const accountOptions = useMemo(
    () => (accounts ?? []).filter((a: Account) => a.status !== "ARCHIVED"),
    [accounts],
  );
  useEffect(() => {
    if (!open) return;
    const next = buildInitialForm();
    if (
      next.accountId &&
      accountOptions.every((account) => account.id !== next.accountId)
    ) {
      next.accountId = accountOptions[0]?.id ?? "";
    }
    if (!next.accountId && accountOptions.length > 0) {
      next.accountId = accountOptions[0]?.id ?? "";
    }
    setForm(next);
  }, [open, defaultAccountId, accountOptions]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await postWithdraw({
      accountId: form.accountId,
      amount: Number(form.amount),
      occurredAt: new Date(form.occurredAt).toISOString(),
      note: form.note || undefined,
    });
    toast.success("已记录取出");
    setOpen(false);
    setForm(buildInitialForm());
    onSuccess?.();
  };
  const disableSubmit =
    !form.accountId || !form.amount || Number(form.amount) === 0;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">记录取出</Button>
      </DialogTrigger>
      <DialogContent data-testid="accounts-ui-dialog-withdraw">
        <DialogHeader>
          <DialogTitle>记录取出</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-2">
          <div className="grid gap-1">
            <Label>账户</Label>
            <Select
              value={form.accountId}
              onValueChange={(v) => setForm((s) => ({ ...s, accountId: v }))}
              disabled={isLoading || accountOptions.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择账户" />
              </SelectTrigger>
              <SelectContent>
                {accountOptions.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}（{account.baseCurrency}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label>金额</Label>
            <Input
              name="amount"
              type="number"
              value={form.amount}
              onChange={onChange}
            />
          </div>
          <div className="grid gap-1">
            <Label>发生时间</Label>
            <Input
              name="occurredAt"
              type="datetime-local"
              value={form.occurredAt}
              onChange={onChange}
            />
          </div>
          <div className="grid gap-1">
            <Label>备注</Label>
            <Input name="note" value={form.note} onChange={onChange} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={disableSubmit}>
              提交
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
