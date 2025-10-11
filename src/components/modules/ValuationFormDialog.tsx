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
import { postValuation, useAccounts, type Account } from "@/lib/api/accounts";
import { toInputDatetimeValue } from "@/lib/utils/datetime";

export function ValuationFormDialog({
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
    totalValue: "",
    asOf: toInputDatetimeValue(new Date()),
    currency: "",
    note: "",
  });
  const [form, setForm] = useState(buildInitialForm);
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
  const valuationCandidates = useMemo(
    () =>
      (accounts ?? []).filter((account: Account) =>
        ["INVESTMENT", "LOAN"].includes(account.accountType),
      ),
    [accounts],
  );
  useEffect(() => {
    if (!open) return;
    const next = buildInitialForm();
    if (
      next.accountId &&
      valuationCandidates.every((account) => account.id !== next.accountId)
    ) {
      next.accountId = valuationCandidates[0]?.id ?? "";
    }
    if (!next.accountId && valuationCandidates.length > 0) {
      next.accountId = valuationCandidates[0]?.id ?? "";
    }
    setForm(next);
  }, [open, defaultAccountId, valuationCandidates]);
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await postValuation({
      accountId: form.accountId,
      asOf: new Date(form.asOf).toISOString(),
      totalValue: Number(form.totalValue),
      currency: form.currency || undefined,
      note: form.note || undefined,
    });
    toast.success("估值记录成功");
    setOpen(false);
    setForm(buildInitialForm());
    onSuccess?.();
  };
  const disableSubmit =
    !form.accountId || !form.totalValue || Number(form.totalValue) === 0;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">记录估值</Button>
      </DialogTrigger>
      <DialogContent data-testid="accounts-ui-dialog-valuation">
        <DialogHeader>
          <DialogTitle>记录账户估值</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3">
          <div className="grid gap-1">
            <Label>账户</Label>
            <Select
              value={form.accountId}
              onValueChange={(v) => setForm((s) => ({ ...s, accountId: v }))}
              disabled={isLoading || valuationCandidates.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择账户" />
              </SelectTrigger>
              <SelectContent>
                {valuationCandidates.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}（{account.accountType} ·{" "}
                    {account.baseCurrency}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label>估值</Label>
            <Input
              name="totalValue"
              type="number"
              value={form.totalValue}
              onChange={onChange}
            />
          </div>
          <div className="grid gap-1">
            <Label>估值时间</Label>
            <Input
              name="asOf"
              type="datetime-local"
              value={form.asOf}
              onChange={onChange}
            />
          </div>
          <div className="grid gap-1">
            <Label>估值币种（可选）</Label>
            <Input name="currency" value={form.currency} onChange={onChange} />
          </div>
          <div className="grid gap-1">
            <Label>备注（可选）</Label>
            <Input name="note" value={form.note} onChange={onChange} />
          </div>
          {valuationCandidates.length === 0 && (
            <p className="text-xs text-muted-foreground">
              当前没有需要记录估值的投资或借贷账户。
            </p>
          )}
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

export default ValuationFormDialog;
