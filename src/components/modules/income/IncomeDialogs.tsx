"use client";

import {
  BonusForm,
  LTCPlanForm,
  SalaryChangeForm,
} from "@/components/modules/income/IncomeForms";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  useBonus,
  useLTCPlans,
  useSalaryChanges,
} from "@/lib/api/income";
import { formatMoney } from "@/lib/domain/money";
import { notifyAsync } from "@/lib/utils/notify";

type DialogBaseProps = {
  open: boolean;
  onClose: () => void;
};

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
                            try {
                              await notifyAsync(
                                () => generateLTCPayouts(it.id),
                                {
                                  loading: "正在生成发放日程…",
                                  success: "已生成发放日程",
                                  error: "生成发放日程失败，请稍后重试",
                                },
                              );
                            } catch (error) {
                              console.error("ltc payouts generation error", error);
                            }
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
