"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserPrefsStore } from "@/lib/state/user-prefs";

export default function SettingsPage() {
  const {
    displayCurrency,
    currentCity,
    asOfDate,
    tableDensity,
    setDisplayCurrency,
    setCurrentCity,
    setAsOfDate,
    setTableDensity,
  } = useUserPrefsStore();
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">设置</h1>
      <Card>
        <CardHeader>
          <CardTitle>用户偏好</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3">
          <div>
            <div className="text-sm text-muted-foreground mb-1">展示币种</div>
            <Input
              value={displayCurrency ?? ""}
              onChange={(e) => setDisplayCurrency(e.target.value || null)}
              placeholder="如 CNY"
            />
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">默认城市</div>
            <Input
              value={currentCity ?? ""}
              onChange={(e) => setCurrentCity(e.target.value || null)}
              placeholder="如 Hangzhou"
            />
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">统计日期</div>
            <Input
              value={asOfDate ?? ""}
              onChange={(e) => setAsOfDate(e.target.value || null)}
              placeholder="YYYY-MM-DD"
            />
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">表格密度</div>
            <Select
              value={tableDensity}
              onValueChange={(v) => setTableDensity(v as any)}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comfortable">舒适</SelectItem>
                <SelectItem value="compact">紧凑</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
