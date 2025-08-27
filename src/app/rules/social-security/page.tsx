"use client";

import RulesUpsertForm from "@/components/modules/RulesUpsertForm";
import { upsertSocialSecurity, useSocialSecurity } from "@/lib/api/rules";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function SocialSecurityRulesPage() {
  const [q, setQ] = useState({ city: "Hangzhou", on: "2025-01-01" });
  const { data } = useSocialSecurity(q.city, q.on);
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">社保规则</h1>
      <Card>
        <CardHeader><CardTitle>查询</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-2">
          <Input placeholder="城市" value={q.city} onChange={(e) => setQ({ ...q, city: e.target.value })} />
          <Input type="date" value={q.on} onChange={(e) => setQ({ ...q, on: e.target.value })} />
          <div className="col-span-3 text-sm text-muted-foreground">
            {data ? (
              <div>基数区间：{Number(data.baseMin)} - {Number(data.baseMax)}，养老率：{Number(data.ratePension)}，医保率：{Number(data.rateMedical)}，失业率：{Number(data.rateUnemployment)}</div>
            ) : (
              <div>输入城市与日期以查询。</div>
            )}
          </div>
        </CardContent>
      </Card>
      <RulesUpsertForm
        title="批量导入/更新 社保规则 (JSON 数组)"
        placeholder='[{"city":"Hangzhou","startDate":"2025-01-01","baseMin":5000,"baseMax":30000,"ratePension":0.08,"rateMedical":0.02,"rateUnemployment":0.005}]'
        onSubmit={(items) => upsertSocialSecurity(items as any)}
      />
    </main>
  );
}
