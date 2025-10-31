"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
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
import { notifyAsync } from "@/lib/utils/notify";
import { toInputDatetimeValue } from "@/lib/utils/datetime";

type TransferDialogProps = {
  defaultFromId?: string;
  defaultToId?: string;
  onSuccess?: () => void;
  trigger?: ReactNode;
};

export function TransferDialog({
  defaultFromId,
  defaultToId,
  onSuccess,
  trigger,
}: TransferDialogProps) {
  const [open, setOpen] = useState(false);
  const { data: accounts, isLoading } = useAccounts();
  const accountOptions = useMemo(
    () => (accounts ?? []).filter((a) => a.status !== "ARCHIVED"),
    [accounts],
  );
  const buildInitialForm = () => ({
    fromAccount: defaultFromId ?? accountOptions[0]?.id ?? "",
    toAccount:
      defaultToId ??
      (accountOptions.length > 1
        ? (accountOptions[1]?.id ?? accountOptions[0]?.id ?? "")
        : (accountOptions[0]?.id ?? "")),
    amount: "",
    occurredAt: toInputDatetimeValue(new Date()),
    note: "",
    attachmentUrl: "",
  });
  const [form, setForm] = useState(buildInitialForm);
  useEffect(() => {
    if (!open) return;
    setForm(buildInitialForm());
  }, [open, defaultFromId, defaultToId, accountOptions]);
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await notifyAsync(
        () =>
          postTransfer({
            from: { accountId: form.fromAccount, amount: Number(form.amount) },
            to: { accountId: form.toAccount },
            occurredAt: new Date(form.occurredAt).toISOString(),
            note: form.note || undefined,
            attachmentUrl: form.attachmentUrl.trim()
              ? form.attachmentUrl.trim()
              : undefined,
          }),
        {
          loading: "正在处理转账…",
          success: "转账成功",
          error: (error) =>
            error instanceof Error && error.message
              ? error.message
              : "转账失败，请稍后重试",
        },
      );
      setOpen(false);
      setForm(buildInitialForm());
      onSuccess?.();
    } catch (error) {
      console.error("transfer submission error", error);
    }
  };
  const disableSubmit =
    !form.fromAccount ||
    !form.toAccount ||
    form.fromAccount === form.toAccount ||
    !form.amount ||
    Number(form.amount) === 0;
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button data-testid="accounts-ui-trigger-transfer" variant="default">
            跨/同币种转账
          </Button>
        )}
      </DialogTrigger>
      <DialogContent data-testid="accounts-ui-dialog-transfer">
        <DialogHeader>
          <DialogTitle>发起转账</DialogTitle>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={onSubmit}>
          <div className="grid gap-1">
            <Label>转出账户</Label>
            <Select
              disabled={isLoading}
              onValueChange={(v) => setForm((s) => ({ ...s, fromAccount: v }))}
              value={form.fromAccount}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择账户" />
              </SelectTrigger>
              <SelectContent>
                {accountOptions.map((a) => (
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
              disabled={isLoading}
              onValueChange={(v) => setForm((s) => ({ ...s, toAccount: v }))}
              value={form.toAccount}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择账户" />
              </SelectTrigger>
              <SelectContent>
                {accountOptions.map((a) => (
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
              onChange={onChange}
              type="number"
              value={form.amount}
            />
          </div>
          <div className="grid gap-1">
            <Label>Occurred At</Label>
            <Input
              name="occurredAt"
              onChange={onChange}
              type="datetime-local"
              value={form.occurredAt}
            />
          </div>
          <div className="grid gap-1">
            <Label>Note</Label>
            <Input name="note" onChange={onChange} value={form.note} />
          </div>
          <div className="grid gap-1">
            <Label>附件链接（可选）</Label>
            <Input
              name="attachmentUrl"
              onChange={onChange}
              placeholder="https://..."
              value={form.attachmentUrl}
            />
          </div>
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

export default TransferDialog;
