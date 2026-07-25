"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EquityGrantForm } from "@/components/modules/income/IncomeForms";
import VestFairValueForm from "@/components/modules/income/VestFairValueForm";
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
import { generateEquityVests, useEquityGrants } from "@/lib/api/income";

/**
 * 格式化股权授予标签
 * @param date - 授予开始日期
 * @returns 格式如 "Grant-2024-01" 的标签
 */
function formatGrantLabel(date: string) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `Grant-${year}-${month}`;
}

/**
 * 格式化归属频率
 * @param value - 归属频率代码
 * @returns 中文标签（月度/季度/年度/自定义）
 */
function formatVestInterval(value: string) {
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

/**
 * 股权激励页面组件
 *
 * 以弹窗形式展示股权激励管理界面，包括：
 * - 股权授予列表：展示所有授予计划的基本信息
 * - 生成归属按钮：为指定授予生成归属日程
 * - 股权授予表单：新增授予计划
 * - 归属公允价值表单：维护归属时的公允价值
 *
 * 关闭弹窗时自动返回 /income 页面。
 *
 * 数据来源：
 * - useEquityGrants: 股权授予列表
 */
export default function EquityPage() {
  const router = useRouter();
  const { data, isLoading } = useEquityGrants();
  const items = data?.items ?? [];

  return (
    <Dialog onOpenChange={(open) => !open && router.push("/income")} open>
      <DialogContent
        className="w-full max-w-[min(98vw,1200px)] sm:max-w-[min(98vw,1200px)] max-h-[88vh]"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>股权激励</DialogTitle>
          <DialogDescription>配置股权授予并维护归属信息。</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="border rounded">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>计划标识</TableHead>
                  <TableHead>开始归属日</TableHead>
                  <TableHead>总份额</TableHead>
                  <TableHead>期数</TableHead>
                  <TableHead>频率</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      className="text-sm text-muted-foreground"
                      colSpan={5}
                    >
                      加载中…
                    </TableCell>
                  </TableRow>
                ) : items.length ? (
                  items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell className="font-medium">
                        {formatGrantLabel(it.startVestDate)}
                      </TableCell>
                      <TableCell>
                        {String(it.startVestDate).slice(0, 10)}
                      </TableCell>
                      <TableCell>{it.totalUnits}</TableCell>
                      <TableCell>{it.vestPeriods}</TableCell>
                      <TableCell className="flex items-center gap-2">
                        <span>{formatVestInterval(it.vestInterval)}</span>
                        <Button
                          onClick={async () => {
                            await generateEquityVests(it.id);
                            toast.success("已生成归属日程");
                          }}
                          size="sm"
                          variant="outline"
                        >
                          生成归属
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      className="text-sm text-muted-foreground"
                      colSpan={5}
                    >
                      暂无数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <EquityGrantForm />
          <VestFairValueForm />
        </div>
      </DialogContent>
    </Dialog>
  );
}
