"use client";

import { useState } from "react";
import RulesUpsertForm from "@/components/modules/identity/RulesUpsertForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { upsertHousingFund, useHousingFund } from "@/lib/api/rules";

export default function HousingFundRulesPage() {
  const [q, setQ] = useState({ city: "Hangzhou", on: "2025-01-01" });
  const { data } = useHousingFund(q.city, q.on);
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">公积金规则</h1>
      <Card>
        <CardHeader>
          <CardTitle>查询</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-2">
          <Input
            onChange={(e) => setQ({ ...q, city: e.target.value })}
            placeholder="城市"
            value={q.city}
          />
          <Input
            onChange={(e) => setQ({ ...q, on: e.target.value })}
            type="date"
            value={q.on}
          />
          <div className="col-span-3 text-sm text-muted-foreground">
            {data ? (
              <div>
                基数区间：{Number(data.baseMin)} - {Number(data.baseMax)}
                ，个人比例：{Number((data as any).rateEmployee)}
              </div>
            ) : (
              <div>输入城市与日期以查询。</div>
            )}
          </div>
        </CardContent>
      </Card>
      <RulesUpsertForm
        onSubmit={(items) => upsertHousingFund(items as any)}
        placeholder='[{"city":"Hangzhou","startDate":"2025-01-01","baseMin":5000,"baseMax":30000,"rateEmployee":0.12}]'
        title="批量导入/更新 公积金规则 (JSON 数组)"
      />
    </main>
  );
}
