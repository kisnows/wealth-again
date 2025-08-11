import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcMonthlyWithholdingCumulative, taxParamsSchema } from "@/lib/tax";
import { ZodError } from "zod";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  const city = searchParams.get("city") || "Hangzhou";
  if (!year)
    return NextResponse.json({ error: "year required" }, { status: 400 });
  const user = await prisma.user.findFirst();
  if (!user) return NextResponse.json({ results: [] });
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
  try {
    const raw = JSON.parse(cfg.value);
    const params = taxParamsSchema.parse(raw);
    const months = income.map((m: any) => ({
      month: m.month,
      gross: Number(m.gross),
      bonus: m.bonus ? Number(m.bonus) : undefined,
      overrides: m.overrides as any,
    }));
    const results = calcMonthlyWithholdingCumulative(months, params, {
      mergeBonusIntoComprehensive: true,
    });
    return NextResponse.json({ results });
  } catch (err: unknown) {
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: "invalid tax params json" },
        { status: 400 }
      );
    }
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "invalid tax params shape", issues: err.issues },
        { status: 400 }
      );
    }
    console.error("/api/income/forecast parse error", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
