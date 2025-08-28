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
import { postTransfer, useAccounts } from "@/lib/api/accounts";

export function TransferDialog({
  defaultFromId,
  defaultToId,
}: {
  defaultFromId?: string;
  defaultToId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    fromAccount: defaultFromId ?? "",
    toAccount: defaultToId ?? "",
    amount: "",
    occurredAt: "",
    note: "",
  });
  const { data: accounts, isLoading } = useAccounts();
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await postTransfer({
      from: { accountId: form.fromAccount, amount: Number(form.amount) },
      to: { accountId: form.toAccount },
      occurredAt: new Date(form.occurredAt).toISOString(),
      note: form.note || undefined,
    });
    toast.success("转账成功");
    setOpen(false);
    setForm({
      fromAccount: "",
      toAccount: "",
      amount: "",
      occurredAt: "",
      note: "",
    });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default">跨/同币种转账</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>发起转账</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3">
          <div className="grid gap-1">
            <Label>转出账户</Label>
            <Select
              value={form.fromAccount}
              onValueChange={(v) => setForm((s) => ({ ...s, fromAccount: v }))}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择账户" />
              </SelectTrigger>
              <SelectContent>
                {(accounts ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({a.baseCurrency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label>转入账户</Label>
            <Select
              value={form.toAccount}
              onValueChange={(v) => setForm((s) => ({ ...s, toAccount: v }))}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择账户" />
              </SelectTrigger>
              <SelectContent>
                {(accounts ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({a.baseCurrency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label>Amount</Label>
            <Input
              name="amount"
              type="number"
              value={form.amount}
              onChange={onChange}
            />
          </div>
          <div className="grid gap-1">
            <Label>Occurred At</Label>
            <Input
              name="occurredAt"
              type="datetime-local"
              value={form.occurredAt}
              onChange={onChange}
            />
          </div>
          <div className="grid gap-1">
            <Label>Note</Label>
            <Input name="note" value={form.note} onChange={onChange} />
          </div>
          <DialogFooter>
            <Button type="submit">提交</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default TransferDialog;
