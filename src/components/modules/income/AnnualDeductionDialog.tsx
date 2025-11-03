"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  type AnnualDeduction,
  upsertAnnualDeduction,
  updateAnnualDeduction,
} from "@/lib/api/income";
import { toast } from "sonner";
import { formatCurrencyLabel } from "@/lib/domain/currency";

const deductionSchema = z.object({
  taxYear: z
    .coerce.number({ invalid_type_error: "请输入税年" })
    .int("税年需为整数")
    .min(2000, "税年需不小于 2000")
    .max(2100, "税年需不大于 2100"),
  annualAmount: z
    .coerce
    .number({ invalid_type_error: "请输入年度额度" })
    .min(0, "年度额度需不小于 0"),
  allocationRule: z.enum(["AVERAGE", "ONCE"], {
    required_error: "请选择分摊方式",
  }),
  note: z
    .string()
    .max(120, "备注最多 120 个字符")
    .optional()
    .transform((value) => (value && value.trim().length > 0 ? value.trim() : undefined)),
});

type DeductionFormValues = z.infer<typeof deductionSchema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deduction?: AnnualDeduction | null;
  onSuccess?: (result: AnnualDeduction) => void;
  currency?: string;
};

export default function AnnualDeductionDialog({
  open,
  onOpenChange,
  deduction,
  onSuccess,
  currency = "CNY",
}: Props) {
  const currencyLabel = formatCurrencyLabel(currency);
  const form = useForm<DeductionFormValues>({
    resolver: zodResolver(deductionSchema),
    defaultValues: {
      taxYear: deduction?.taxYear ?? new Date().getUTCFullYear(),
      annualAmount: deduction?.annualAmount ?? 0,
      allocationRule: deduction?.allocationRule ?? "AVERAGE",
      note: deduction?.note ?? "",
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      taxYear: deduction?.taxYear ?? new Date().getUTCFullYear(),
      annualAmount: deduction?.annualAmount ?? 0,
      allocationRule: deduction?.allocationRule ?? "AVERAGE",
      note: deduction?.note ?? "",
    });
  }, [deduction, form, open]);

  const isEditing = Boolean(deduction?.id);

  const handleSubmit = async (values: DeductionFormValues) => {
    try {
      let result: AnnualDeduction;
      if (deduction?.id) {
        result = await updateAnnualDeduction(deduction.id, {
          taxYear: values.taxYear,
          annualAmount: values.annualAmount,
          allocationRule: values.allocationRule,
          note: values.note,
        });
        toast.success(`已更新 ${values.taxYear} 年专项附加扣除`);
      } else {
        result = await upsertAnnualDeduction({
          taxYear: values.taxYear,
          annualAmount: values.annualAmount,
          allocationRule: values.allocationRule,
          note: values.note,
        });
        toast.success(`已保存 ${values.taxYear} 年专项附加扣除`);
      }
      onSuccess?.(result);
      onOpenChange(false);
    } catch (error) {
      console.error("annual deduction submit error:", error);
      const message =
        error instanceof Error ? error.message : "保存失败，请稍后重试";
      toast.error(message);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        data-testid="settings-ui-deductions-dialog"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>{isEditing ? "编辑专项附加扣除" : "新增专项附加扣除"}</DialogTitle>
          <DialogDescription>
            统一维护个人年度专项附加扣除额度，系统会按月均摊应用到收入回算中。金额单位：{currencyLabel}。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="grid gap-4"
            data-testid="settings-ui-deductions-form"
            onSubmit={form.handleSubmit(handleSubmit)}
          >
            <FormField
              control={form.control}
              name="taxYear"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>税年</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="numeric"
                      min={2000}
                      max={2100}
                      placeholder="例如：2025"
                      type="number"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="annualAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>年度额度</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="decimal"
                      min={0}
                      placeholder="请输入年度扣除金额"
                      step="0.01"
                      type="number"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    请输入 {currencyLabel} 金额，系统会按税务币种保存和回算。
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="allocationRule"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>分摊方式</FormLabel>
                  <FormControl>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择分摊方式" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AVERAGE">平均分摊</SelectItem>
                        <SelectItem value="ONCE">一次性扣除</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>备注（可选）</FormLabel>
                  <FormControl>
                    <Textarea
                      maxLength={120}
                      placeholder="如子女教育、住房租金等，可帮助后续审计追溯"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                data-testid="settings-ui-deductions-submit"
                disabled={form.formState.isSubmitting}
                type="submit"
              >
                {form.formState.isSubmitting
                  ? "保存中..."
                  : isEditing
                    ? "保存变更"
                    : "保存专项扣除"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
