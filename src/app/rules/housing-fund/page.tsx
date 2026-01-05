"use client";

import { useState } from "react";
import RulesUpsertForm from "@/components/modules/identity/RulesUpsertForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  type HousingFundRuleInput,
  upsertHousingFund,
  useHousingFund,
} from "@/lib/api/rules";

/**
 * 类型守卫：校验对象是否为有效的公积金规则输入
 * @param value - 待校验的对象
 * @returns 是否为有效的 HousingFundRuleInput
 */
function isHousingFundRuleInput(value: unknown): value is HousingFundRuleInput {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (typeof record.city !== "string" || record.city.trim() === "") return false;
  const requiredNumbers: Array<keyof HousingFundRuleInput> = [
    "baseMin",
    "baseMax",
    "rateEmployee",
  ];
  if (
    requiredNumbers.some((key) => {
      const candidate = record[key as string];
      return typeof candidate !== "number" || Number.isNaN(candidate);
    })
  ) {
    return false;
  }
  const optionalStrings: Array<keyof HousingFundRuleInput> = [
    "country",
    "currency",
    "startDate",
    "endDate",
    "effectiveFrom",
    "effectiveTo",
  ];
  return optionalStrings.every((key) => {
    const candidate = record[key as string];
    return (
      candidate === undefined ||
      candidate === null ||
      typeof candidate === "string"
    );
  });
}

/**
 * 公积金规则管理页面组件
 *
 * 提供城市住房公积金规则的查询与配置界面，包括：
 * - 规则查询：按城市与日期查询当前生效的公积金规则
 * - 规则详情：展示缴费基数范围与个人缴存比例
 * - 批量配置：支持 JSON 格式批量导入公积金规则
 *
 * 数据来源：
 * - useHousingFund: 公积金规则查询
 */
export default function HousingFundRulesPage() {
  const [q, setQ] = useState({ city: "Hangzhou", on: "2025-01-01" });
  const { data } = useHousingFund(q.city, q.on);
  const handleSubmit = async (items: unknown[]) => {
    const parsed: HousingFundRuleInput[] = items.map((item) => {
      if (!isHousingFundRuleInput(item)) {
        throw new Error("公积金规则格式不正确，需包含城市与数值字段。");
      }
      return {
        city: item.city,
        country: item.country,
        baseMin: item.baseMin,
        baseMax: item.baseMax,
        rateEmployee: item.rateEmployee,
        currency: item.currency,
        startDate: item.startDate,
        endDate: item.endDate,
        effectiveFrom: item.effectiveFrom,
        effectiveTo: item.effectiveTo,
      } satisfies HousingFundRuleInput;
    });
    await upsertHousingFund(parsed);
  };
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
                ，个人比例：{Number(data.rateEmployee)}
              </div>
            ) : (
              <div>输入城市与日期以查询。</div>
            )}
          </div>
        </CardContent>
      </Card>
      <RulesUpsertForm
        onSubmit={handleSubmit}
        placeholder='[{"city":"Hangzhou","startDate":"2025-01-01","baseMin":5000,"baseMax":30000,"rateEmployee":0.12}]'
        title="批量导入/更新 公积金规则 (JSON 数组)"
      />
    </main>
  );
}
