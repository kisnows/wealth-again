"use client";

import RulesUpsertForm from "@/components/modules/identity/RulesUpsertForm";
import { upsertCities } from "@/lib/api/rules";

export default function CitiesRulesPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">城市</h1>
      <RulesUpsertForm
        onSubmit={(items) => upsertCities(items as any)}
        placeholder='[{"name":"Hangzhou","country":"CN"}]'
        title="批量导入/更新 城市词表 (JSON 数组)"
      />
    </main>
  );
}
