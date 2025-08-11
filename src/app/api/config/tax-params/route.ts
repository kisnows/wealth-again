import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { taxParamsSchema } from "@/lib/tax";
import { ZodError } from "zod";
import { fetchHangzhouParams } from "@/lib/sources/hz-params";

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch (e) {
      return NextResponse.json({ error: "invalid json body" }, { status: 400 });
    }
    const parsed = taxParamsSchema.parse(body);
    const key = `tax:${parsed.city}:${parsed.year}`;
    const rec = await prisma.config.create({
      data: {
        key,
        value: JSON.stringify(parsed),
        effectiveFrom: new Date(`${parsed.year}-01-01`),
      },
    });
    return NextResponse.json({ id: rec.id, key }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "invalid body", issues: err.issues },
        { status: 400 }
      );
    }
    console.error("POST /api/config/tax-params error:", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
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
  let rec = await prisma.config.findFirst({
    where: { key },
    orderBy: { effectiveFrom: "desc" },
  });
  if (!rec) {
    // Auto bootstrap for Hangzhou if not found
    if (city === "Hangzhou") {
      const params = await fetchHangzhouParams({ year: Number(year), city });
      rec = await prisma.config.create({
        data: {
          key,
          value: JSON.stringify(params),
          effectiveFrom: new Date(`${year}-01-01`),
        },
      });
    } else {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
  }
  return NextResponse.json({ key, params: JSON.parse(rec.value) });
}
