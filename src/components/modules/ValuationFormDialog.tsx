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
import { postValuation } from "@/lib/api/accounts";

export function ValuationFormDialog({
  defaultAccountId,
}: {
  defaultAccountId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    accountId: defaultAccountId ?? "",
    totalValue: "",
    asOf: "",
    currency: "",
  });
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await postValuation({
      accountId: form.accountId,
      asOf: new Date(form.asOf).toISOString(),
      totalValue: Number(form.totalValue),
      currency: form.currency || undefined,
    });
    toast.success("估值记录成功");
    setOpen(false);
    setForm({ accountId: "", totalValue: "", asOf: "", currency: "" });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">记录估值</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>记录账户估值</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3">
          <div className="grid gap-1">
            <Label>Account ID</Label>
            <Input
              name="accountId"
              value={form.accountId}
              onChange={onChange}
            />
          </div>
          <div className="grid gap-1">
            <Label>Total Value</Label>
            <Input
              name="totalValue"
              type="number"
              value={form.totalValue}
              onChange={onChange}
            />
          </div>
          <div className="grid gap-1">
            <Label>As Of</Label>
            <Input
              name="asOf"
              type="datetime-local"
              value={form.asOf}
              onChange={onChange}
            />
          </div>
          <div className="grid gap-1">
            <Label>Currency (可选)</Label>
            <Input name="currency" value={form.currency} onChange={onChange} />
          </div>
          <DialogFooter>
            <Button type="submit">提交</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ValuationFormDialog;
