import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { taxParamsSchema } from "@/lib/tax";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = taxParamsSchema.parse(body);
  const key = `tax:${parsed.city}:${parsed.year}`;
  const rec = await prisma.config.create({
    data: {
      key,
      value: parsed,
      effectiveFrom: new Date(`${parsed.year}-01-01`),
    },
  });
  return NextResponse.json({ id: rec.id, key });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  const year = searchParams.get("year");
  if (!city || !year)
    return NextResponse.json(
      { error: "city & year required" },
      { status: 400 }
    );
  const key = `tax:${city}:${year}`;
  const rec = await prisma.config.findFirst({
    where: { key },
    orderBy: { effectiveFrom: "desc" },
  });
  if (!rec) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ key, params: rec.value });
}
