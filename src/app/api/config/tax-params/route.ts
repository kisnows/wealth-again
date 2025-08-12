import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { taxParamsSchema } from "@/lib/tax";
import { ZodError } from "zod";
import { fetchHangzhouParams } from "@/lib/sources/hz-params";

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch (e) {
      return NextResponse.json({ error: "invalid json body" }, { status: 400 });
    }
    const parsed = taxParamsSchema.parse(body);
    const key = `tax:${parsed.city}:${parsed.year}`;
    const effectiveFrom =
      body && body.effectiveFrom
        ? new Date(body.effectiveFrom)
        : new Date(`${parsed.year}-01-01`);
    const rec = await prisma.config.create({
      data: {
        key,
        value: JSON.stringify(parsed),
        effectiveFrom,
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
  const page = Number(searchParams.get("page") || "1");
  const pageSize = Number(searchParams.get("pageSize") || "50");
  if (!city || !year)
    return NextResponse.json(
      { error: "city & year required" },
      { status: 400 }
    );
  const key = `tax:${city}:${year}`;
  const skip = (page - 1) * pageSize;
  const [total, latest, records] = await Promise.all([
    prisma.config.count({ where: { key } }),
    prisma.config.findFirst({
      where: { key },
      orderBy: { effectiveFrom: "desc" },
    }),
    prisma.config.findMany({
      where: { key },
      orderBy: { effectiveFrom: "desc" },
      skip,
      take: pageSize,
    }),
  ]);
  if (!latest) {
    // Auto bootstrap for Hangzhou if not found
    if (city === "Hangzhou") {
      const params = await fetchHangzhouParams({ year: Number(year), city });
      const rec = await prisma.config.create({
        data: {
          key,
          value: JSON.stringify(params),
          effectiveFrom: new Date(`${year}-01-01`),
        },
      });
      return NextResponse.json({
        key,
        params: params,
        total: 1,
        page: 1,
        pageSize: pageSize,
        records: [rec],
      });
    } else {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
  }
  return NextResponse.json({
    key,
    params: JSON.parse(latest.value),
    total,
    page,
    pageSize,
    records,
  });
}
