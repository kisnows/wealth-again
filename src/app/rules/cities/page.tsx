"use client";

import RulesUpsertForm from "@/components/modules/identity/RulesUpsertForm";
import { upsertCities } from "@/lib/api/rules";

type CityRuleInput = {
  name: string;
  country?: string;
};

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
