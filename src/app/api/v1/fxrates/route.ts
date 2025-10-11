import type { Prisma } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";

/**
 * GET /api/v1/fxrates?base=USD&quote=CNY&on=2025-08-01
 * - 查询指定日期的汇率快照（USD 为中间价）。
 * - 返回: { todo: string, base?: string, quote?: string, on?: string }
 *
 * POST /api/v1/fxrates
 * - 写入汇率快照。
 * - 入参: { base: string, quote: string, rate: number, asOf: string(ISO) }
 * - 返回: { todo: string }
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const base = searchParams.get("base") ?? "USD";
  const quote = searchParams.get("quote");
  const on = searchParams.get("on");
  if (!quote)
    return NextResponse.json({ error: "quote is required" }, { status: 400 });
  let where: Prisma.FxRateWhereInput = { base, quote };
  if (on) {
    const onDate = new Date(on);
    const rec = await prisma.fxRate.findFirst({
      where: { base, quote, asOf: { lte: onDate } },
      orderBy: { asOf: "desc" },
    });
    if (rec) return NextResponse.json(rec);
    // 回退精确匹配
    where = { base, quote, asOf: onDate };
  }
  const rate = await prisma.fxRate.findFirst({
    where,
    orderBy: { asOf: "desc" },
  });
  if (!rate) return NextResponse.json({ error: "Not Found" }, { status: 404 });
  return NextResponse.json(rate);
}

type CreateFxRatePayload = {
  base: string;
  quote: string;
  rate: number;
  asOf: string;
};

export async function POST(req: NextRequest) {
  const { base, quote, rate, asOf } = (await req.json()) as CreateFxRatePayload;
  if (!base || !quote || typeof rate !== "number" || !asOf) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const created = await prisma.fxRate.create({
    data: { base, quote, rate, asOf: new Date(asOf) },
  });
  return NextResponse.json(created, { status: 201 });
}
