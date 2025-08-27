import prisma from "@/server/db";

export async function upsertCityRules(items: Array<{ name: string; country?: string }>) {
  for (const it of items) {
    await prisma.city.upsert({ where: { name: it.name }, update: { country: it.country || "CN" }, create: { name: it.name, country: it.country || "CN" } });
  }
  return { upserted: items.length } as const;
}
