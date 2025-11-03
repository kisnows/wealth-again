"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
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
import { type Account, postValuation, useAccounts } from "@/lib/api/accounts";
import { notifyAsync } from "@/lib/utils/notify";
import { toInputDatetimeValue } from "@/lib/utils/datetime";

type ValuationFormDialogProps = {
  defaultAccountId?: string;
  onSuccess?: () => void;
  trigger?: ReactNode;
};

export function ValuationFormDialog({
  defaultAccountId,
  onSuccess,
  trigger,
}: ValuationFormDialogProps) {
  const [open, setOpen] = useState(false);
  const { data: accounts, isLoading } = useAccounts();
  const buildInitialForm = useCallback(
    () => ({
      accountId: defaultAccountId ?? "",
      totalValue: "",
      asOf: toInputDatetimeValue(new Date()),
      currency: "",
      note: "",
    }),
    [defaultAccountId],
  );
  const [form, setForm] = useState(buildInitialForm);
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
  const valuationCandidates = useMemo(
    () =>
      (accounts ?? []).filter(
        (account: Account) =>
          ["INVESTMENT", "LOAN"].includes(account.accountType) &&
          account.status !== "ARCHIVED",
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
  }, [open, valuationCandidates, buildInitialForm]);
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await notifyAsync(
        () =>
          postValuation({
            accountId: form.accountId,
            asOf: new Date(form.asOf).toISOString(),
            totalValue: Number(form.totalValue),
            currency: form.currency || undefined,
            note: form.note || undefined,
          }),
        {
          loading: "正在记录估值…",
          success: "估值记录成功",
          error: (error) =>
            error instanceof Error && error.message
              ? error.message
              : "估值记录失败，请稍后重试",
        },
      );
      setOpen(false);
      setForm(buildInitialForm());
      onSuccess?.();
    } catch (error) {
      console.error("valuation submission error", error);
    }
  };
  const disableSubmit =
    !form.accountId || !form.totalValue || Number(form.totalValue) === 0;
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button data-testid="accounts-ui-trigger-valuation" variant="secondary">
            记录估值
          </Button>
        )}
      </DialogTrigger>
      <DialogContent data-testid="accounts-ui-dialog-valuation">
        <DialogHeader>
          <DialogTitle>记录账户估值</DialogTitle>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={onSubmit}>
          <div className="grid gap-1">
            <Label>账户</Label>
            <Select
              disabled={isLoading || valuationCandidates.length === 0}
              onValueChange={(v) => setForm((s) => ({ ...s, accountId: v }))}
              value={form.accountId}
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
              onChange={onChange}
              type="number"
              value={form.totalValue}
            />
          </div>
          <div className="grid gap-1">
            <Label>估值时间</Label>
            <Input
              name="asOf"
              onChange={onChange}
              type="datetime-local"
              value={form.asOf}
            />
          </div>
          <div className="grid gap-1">
            <Label>估值币种（可选）</Label>
            <Input name="currency" onChange={onChange} value={form.currency} />
          </div>
          <div className="grid gap-1">
            <Label>备注（可选）</Label>
            <Input name="note" onChange={onChange} value={form.note} />
          </div>
          {valuationCandidates.length === 0 && (
            <p className="text-xs text-muted-foreground">
              当前没有需要记录估值的投资或借贷账户。
            </p>
          )}
          <DialogFooter>
            <Button disabled={disableSubmit} type="submit">
              提交
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ValuationFormDialog;
