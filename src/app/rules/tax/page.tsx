"use client";

import RulesUpsertForm from "@/components/modules/RulesUpsertForm";
import { upsertTaxBrackets, upsertTaxConfig, useTaxBrackets } from "@/lib/api/rules";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function TaxRulesPage() {
  const [cfg, setCfg] = useState({ country: "CN", taxYear: "2025", standardDeduction: "5000" });
  const { data } = useTaxBrackets(cfg.country, Number(cfg.taxYear));
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">税制与税表</h1>
      <Card>
        <CardHeader><CardTitle>税制配置</CardTitle></CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-3">
          <Input placeholder="Country" value={cfg.country} onChange={(e) => setCfg({ ...cfg, country: e.target.value })} />
          <Input placeholder="Tax Year" type="number" value={cfg.taxYear} onChange={(e) => setCfg({ ...cfg, taxYear: e.target.value })} />
          <Input placeholder="Standard Deduction" type="number" value={cfg.standardDeduction} onChange={(e) => setCfg({ ...cfg, standardDeduction: e.target.value })} />
          <Button className="mt-2" onClick={() => upsertTaxConfig({ country: cfg.country, taxYear: Number(cfg.taxYear), standardDeduction: Number(cfg.standardDeduction) })}>提交</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>当前税率表</CardTitle></CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-2">国家：{cfg.country} 税年：{cfg.taxYear}</div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="p-2">档位</th>
                  <th className="p-2">阈值(累计)</th>
                  <th className="p-2">税率</th>
                  <th className="p-2">速算扣除</th>
                </tr>
              </thead>
              <tbody>
                {(data as any)?.items?.map?.((b: any, i: number) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{b.position}</td>
                    <td className="p-2">{b.threshold}</td>
                    <td className="p-2">{b.taxRate}</td>
                    <td className="p-2">{b.quickDeduction}</td>
                  </tr>
                )) || (
                  <tr><td className="p-2 text-muted-foreground" colSpan={4}>无记录</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <RulesUpsertForm
        title="批量导入/更新 税率表 (JSON 数组)"
        placeholder='[{"country":"CN","taxYear":2025,"position":1,"threshold":36000,"taxRate":0.03,"quickDeduction":0}]'
        onSubmit={(items) => upsertTaxBrackets(items as any)}
      />
    </main>
  );
}
