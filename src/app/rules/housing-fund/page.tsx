"use client";

import RulesUpsertForm from "@/components/modules/RulesUpsertForm";
import { upsertHousingFund, useHousingFund } from "@/lib/api/rules";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function HousingFundRulesPage() {
  const [q, setQ] = useState({ city: "Hangzhou", on: "2025-01-01" });
  const { data } = useHousingFund(q.city, q.on);
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">公积金规则</h1>
      <Card>
        <CardHeader><CardTitle>查询</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-2">
          <Input placeholder="城市" value={q.city} onChange={(e) => setQ({ ...q, city: e.target.value })} />
          <Input type="date" value={q.on} onChange={(e) => setQ({ ...q, on: e.target.value })} />
          <div className="col-span-3 text-sm text-muted-foreground">
            {data ? (
              <div>基数区间：{Number(data.baseMin)} - {Number(data.baseMax)}，个人比例：{Number((data as any).rateEmployee)}，公司比例：{Number((data as any).rateEmployer)}</div>
            ) : (
              <div>输入城市与日期以查询。</div>
            )}
          </div>
        </CardContent>
      </Card>
      <RulesUpsertForm
        title="批量导入/更新 公积金规则 (JSON 数组)"
        placeholder='[{"city":"Hangzhou","startDate":"2025-01-01","baseMin":5000,"baseMax":30000,"rateEmployee":0.12,"rateEmployer":0.12}]'
        onSubmit={(items) => upsertHousingFund(items as any)}
      />
    </main>
  );
}
