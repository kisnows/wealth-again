"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { postDeposit } from "@/lib/api/accounts";
import { toast } from "sonner";

export default function DepositDialog({ defaultAccountId }: { defaultAccountId?: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ accountId: defaultAccountId ?? "", amount: "", occurredAt: "", note: "" });
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await postDeposit({ accountId: form.accountId, amount: Number(form.amount), occurredAt: new Date(form.occurredAt).toISOString(), note: form.note || undefined });
    toast.success("已记录存入");
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline">记录存入</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>记录存入</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-2">
          <div className="grid gap-1"><Label>Account ID</Label><Input name="accountId" value={form.accountId} onChange={onChange} /></div>
          <div className="grid gap-1"><Label>Amount</Label><Input name="amount" type="number" value={form.amount} onChange={onChange} /></div>
          <div className="grid gap-1"><Label>Occurred At</Label><Input name="occurredAt" type="datetime-local" value={form.occurredAt} onChange={onChange} /></div>
          <div className="grid gap-1"><Label>Note</Label><Input name="note" value={form.note} onChange={onChange} /></div>
          <DialogFooter><Button type="submit">提交</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
