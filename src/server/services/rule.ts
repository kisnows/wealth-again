import db from "@/server/db";
import { cities } from "@/server/db/schema";

export async function upsertCityRules(
  items: Array<{ name: string; country?: string }>,
) {
  for (const it of items) {
    const country = it.country || "CN";
    await db
      .insert(cities)
      .values({ name: it.name, country })
      .onConflictDoUpdate({
        target: cities.name,
        set: { country },
      });
  }
  return { upserted: items.length } as const;
}
