import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { taxParamsSchema, calcMonthlyWithholdingCumulative } from "@/lib/tax";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  const city = searchParams.get("city") || "Hangzhou";
  if (!year)
    return NextResponse.json({ error: "year required" }, { status: 400 });
  const user = await prisma.user.findFirst();
  if (!user) return NextResponse.json({ summary: null });
  const income = await prisma.incomeRecord.findMany({
    where: { userId: user.id, year },
    orderBy: { month: "asc" },
  });
  const cfg = await prisma.config.findFirst({
    where: { key: `tax:${city}:${year}` },
    orderBy: { effectiveFrom: "desc" },
  });
  if (!cfg)
    return NextResponse.json({ error: "tax params missing" }, { status: 400 });
  const params = taxParamsSchema.parse(cfg.value);
  const months = income.map((m: any) => ({
    month: m.month,
    gross: Number(m.gross),
    bonus: m.bonus ? Number(m.bonus) : undefined,
    overrides: m.overrides as any,
  }));
  const calc = calcMonthlyWithholdingCumulative(months, params, {
    mergeBonusIntoComprehensive: true,
  });
  const totalGross = months.reduce(
    (a: number, b: any) => a + b.gross + (b.bonus || 0),
    0
  );
  const totalTax = calc.reduce((a: number, b: any) => a + b.taxThisMonth, 0);
  const totalNet = calc.reduce((a: number, b: any) => a + b.net, 0);
  return NextResponse.json({
    summary: { totalGross, totalTax, totalNet, months: calc },
  });
}
