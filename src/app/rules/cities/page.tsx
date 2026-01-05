"use client";

import RulesUpsertForm from "@/components/modules/identity/RulesUpsertForm";
import { upsertCities } from "@/lib/api/rules";

/** 城市规则输入类型 */
type CityRuleInput = {
  name: string;
  country?: string;
};

/**
 * 类型守卫：校验对象是否为有效的城市规则输入
 * @param value - 待校验的对象
 * @returns 是否为有效的 CityRuleInput
 */
function isCityRuleInput(value: unknown): value is CityRuleInput {
  if (!value || typeof value !== "object") return false;
  const record = value as { name?: unknown; country?: unknown };
  if (typeof record.name !== "string" || record.name.trim() === "") return false;
  if (
    record.country !== undefined &&
    record.country !== null &&
    typeof record.country !== "string"
  ) {
    return false;
  }
  return true;
}

/**
 * 城市名录管理页面组件
 *
 * 提供城市词表的批量导入与更新功能。
 * 城市信息用于关联社保、公积金与税务规则。
 *
 * 输入格式：JSON 数组，每项包含 name（必填）和 country（可选）字段。
 */
export default function CitiesRulesPage() {
  const handleSubmit = async (items: unknown[]) => {
    if (!items.every(isCityRuleInput)) {
      throw new Error("城市规则格式不正确，需包含 name 字段。");
    }
    await upsertCities(items.map((item) => ({ name: item.name, country: item.country })));
  };

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">城市</h1>
      <RulesUpsertForm
        onSubmit={handleSubmit}
        placeholder='[{"name":"Hangzhou","country":"CN"}]'
        title="批量导入/更新 城市词表 (JSON 数组)"
      />
    </main>
  );
}
