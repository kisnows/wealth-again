"use client";

import { useState } from "react";
import { toast } from "sonner";
import CitySelect from "@/components/modules/CitySelect";
import {
  BonusForm,
  LTCPlanForm,
  SalaryChangeForm,
} from "@/components/modules/IncomeForms";
import IncomeRecordsTable from "@/components/modules/IncomeRecordsTable";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  generateLTCPayouts,
  postIncomeRecalc,
  useBonus,
  useLTCPlans,
  useSalaryChanges,
} from "@/lib/api/income";
import { formatMoney } from "@/lib/domain/money";
import { useIncomeStore } from "@/lib/state/income";

type DialogBaseProps = {
  open: boolean;
  onClose: () => void;
};

const baseDialogClasses =
  "w-full max-w-[min(98vw,1280px)] sm:max-w-[min(98vw,1280px)]";

export function IncomeRecordsDialog({ open, onClose }: DialogBaseProps) {
  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      open={open}
    >
      <DialogContent
        className={`${baseDialogClasses} h-[90vh]`}
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>收入记录</DialogTitle>
          <DialogDescription>
            展示月度收入明细，可执行人工调整或导出数据。
          </DialogDescription>
        </DialogHeader>
        <div className="h-full overflow-y-auto pr-1">
          <IncomeRecordsTable />
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={onClose} variant="ghost">
            返回
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const formDialogClasses =
  "w-full max-w-[min(98vw,1080px)] sm:max-w-[min(98vw,1080px)]";

export function SalaryChangesDialog({ open, onClose }: DialogBaseProps) {
  const { data, isLoading } = useSalaryChanges();
  const items = data?.items ?? [];

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      open={open}
    >
      <DialogContent
        className={`${formDialogClasses} max-h-[88vh]`}
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>工资变更管理</DialogTitle>
          <DialogDescription>
            查看历史记录并新增或编辑工资变更
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto pr-1">
          <div className="border rounded">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>生效日期</TableHead>
                  <TableHead className="text-right">税前月薪</TableHead>
                  <TableHead className="text-right">币种</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      className="text-sm text-muted-foreground"
                      colSpan={3}
                    >
                      加载中…
                    </TableCell>
                  </TableRow>
                ) : items.length ? (
                  items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell>
                        {String(it.effectiveFrom).slice(0, 10)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatMoney(
                          Number(it.grossMonthly),
                          it.currency || "CNY",
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {it.currency}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      className="text-sm text-muted-foreground"
                      colSpan={3}
                    >
                      暂无数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <SalaryChangeForm />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function BonusDialog({ open, onClose }: DialogBaseProps) {
  const { data, isLoading } = useBonus();
  const items = data?.items ?? [];

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      open={open}
    >
      <DialogContent
        className={`${formDialogClasses} max-h-[88vh]`}
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>一次性奖金</DialogTitle>
          <DialogDescription>维护奖金计划与计税方式</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto pr-1">
          <div className="border rounded">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>发放日期</TableHead>
                  <TableHead className="text-right">金额</TableHead>
                  <TableHead className="text-right">币种</TableHead>
                  <TableHead>计税方式</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      className="text-sm text-muted-foreground"
                      colSpan={4}
                    >
                      加载中…
                    </TableCell>
                  </TableRow>
                ) : items.length ? (
                  items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell>
                        {String(it.effectiveDate).slice(0, 10)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatMoney(Number(it.amount), it.currency || "CNY")}
                      </TableCell>
                      <TableCell className="text-right">
                        {it.currency}
                      </TableCell>
                      <TableCell>
                        {it.taxMethod === "MERGE" ? "合并计税" : "单独计税"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      className="text-sm text-muted-foreground"
                      colSpan={4}
                    >
                      暂无数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <BonusForm />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function IncomeRecalcDialog({ open, onClose }: DialogBaseProps) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const defaultEndMonth = String(today.getMonth() + 1).padStart(2, "0");
  const [form, setForm] = useState({
    taxYear: `${currentYear}`,
    endMonth: defaultEndMonth,
    cityId: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const notifyRecalc = useIncomeStore((state) => state.notifyRecalc);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const taxYearNumber = Number(form.taxYear);
      const endMonthNumber = Number(form.endMonth);

      if (
        Number.isNaN(taxYearNumber) ||
        taxYearNumber < 2000 ||
        Number.isNaN(endMonthNumber) ||
        endMonthNumber < 1 ||
        endMonthNumber > 12
      ) {
        toast.error("请填写有效的税年与截止月份");
        setSubmitting(false);
        return;
      }

      const payload = {
        taxYear: taxYearNumber,
        endMonth: endMonthNumber,
        cityId: form.cityId || undefined,
      };
      const result = await postIncomeRecalc(payload);
      toast.success(`回算完成，本次更新 ${result?.updated ?? 0} 条记录`);
      notifyRecalc();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "回算失败，请稍后再试";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      open={open}
    >
      <DialogContent
        className={`${formDialogClasses} max-h-[88vh]`}
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>年度回算</DialogTitle>
          <DialogDescription>
            以累计预扣法重新计算 1 月至指定月份的工资、社保、公积金与个税记录
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="recalc-tax-year">税年</Label>
              <Input
                id="recalc-tax-year"
                min="2000"
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, taxYear: event.target.value }))
                }
                type="number"
                value={form.taxYear}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recalc-end-month">截止月份</Label>
              <Input
                id="recalc-end-month"
                max="12"
                min="1"
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, endMonth: event.target.value }))
                }
                type="number"
                value={form.endMonth}
              />
            </div>
            <div className="space-y-2">
              <Label>指定城市（可选）</Label>
              <div className="flex items-center gap-2">
                <CitySelect
                  className="w-full"
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, cityId: value }))
                  }
                  placeholder="默认使用当前城市"
                  value={form.cityId || undefined}
                />
                {form.cityId ? (
                  <Button
                    onClick={() => setForm((prev) => ({ ...prev, cityId: "" }))}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    清除
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
            系统将在后台按月份重算 IncomeRecord
            并回填对账字段。完成后，概览与预测数据会自动刷新。
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={onClose} type="button" variant="ghost">
              取消
            </Button>
            <Button disabled={submitting} type="submit">
              {submitting ? "回算中..." : "开始回算"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function formatPlanLabel(startDate: string) {
  const date = new Date(startDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `LTC-${year}-${month}`;
}

function formatRecurrence(value: string) {
  switch (value) {
    case "MONTHLY":
      return "月度";
    case "QUARTERLY":
      return "季度";
    case "YEARLY":
      return "年度";
    case "CUSTOM":
      return "自定义";
    default:
      return value;
  }
}

export function LongTermCashDialog({ open, onClose }: DialogBaseProps) {
  const { data, isLoading } = useLTCPlans();
  const items = data?.items ?? [];
  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      open={open}
    >
      <DialogContent
        className={`${formDialogClasses} max-h-[88vh]`}
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>长期现金计划</DialogTitle>
          <DialogDescription>维护长期现金激励计划与发放节奏</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto pr-1">
          <div className="border rounded">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>计划标识</TableHead>
                  <TableHead>开始日期</TableHead>
                  <TableHead>总金额</TableHead>
                  <TableHead>期数</TableHead>
                  <TableHead>频率</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      className="text-sm text-muted-foreground"
                      colSpan={6}
                    >
                      加载中…
                    </TableCell>
                  </TableRow>
                ) : items.length ? (
                  items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell className="font-medium">
                        {formatPlanLabel(it.startDate)}
                      </TableCell>
                      <TableCell>{String(it.startDate).slice(0, 10)}</TableCell>
                      <TableCell>
                        {formatMoney(
                          Number(it.totalAmount),
                          it.currency || "CNY",
                        )}
                      </TableCell>
                      <TableCell>{it.periods}</TableCell>
                      <TableCell>{formatRecurrence(it.recurrence)}</TableCell>
                      <TableCell>
                        <Button
                          onClick={async () => {
                            await generateLTCPayouts(it.id);
                            toast.success("已生成发放日程");
                          }}
                          size="sm"
                          variant="outline"
                        >
                          生成日程
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      className="text-sm text-muted-foreground"
                      colSpan={6}
                    >
                      暂无数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <LTCPlanForm />
        </div>
      </DialogContent>
    </Dialog>
  );
}
