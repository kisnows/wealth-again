"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EquityGrantForm } from "@/components/modules/IncomeForms";
import VestFairValueForm from "@/components/modules/VestFairValueForm";
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

function formatGrantLabel(date: string) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `Grant-${year}-${month}`;
}

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
