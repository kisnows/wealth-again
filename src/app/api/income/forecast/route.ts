import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calcMonthlyWithholdingCumulative,
  normalizeTaxParamsValue,
  TaxParams,
} from "@/lib/tax";
import { ZodError } from "zod";
import { fetchHangzhouParams } from "@/lib/sources/hz-params";

function ymToDateEnd(ym: string): Date {
  const [y, m] = ym.split("-").map((n) => Number(n));
  return new Date(y, m, 0);
}

function iterateMonths(
  start: Date,
  end: Date
): { y: number; m: number; endDate: Date }[] {
  const res: { y: number; m: number; endDate: Date }[] = [];
  const d = new Date(start.getFullYear(), start.getMonth(), 1);
  const endKey = end.getFullYear() * 100 + end.getMonth();
  while (d.getFullYear() * 100 + d.getMonth() <= endKey) {
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    res.push({ y, m, endDate: new Date(y, m, 0) });
    d.setMonth(d.getMonth() + 1);
  }
  return res;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city") || "Hangzhou";
  const startYM = searchParams.get("start");
  const endYM = searchParams.get("end");
  const year = Number(searchParams.get("year"));
  const horizon = Number(searchParams.get("months") || "12");
  if (!year && !(startYM && endYM))
    return NextResponse.json(
      { error: "year or start/end required" },
      { status: 400 }
    );
  const user = await prisma.user.findFirst();
  if (!user) return NextResponse.json({ results: [] });

  // 时间范围
  let rangeStart: Date;
  let rangeEnd: Date;
  if (startYM && endYM) {
    rangeStart = new Date(
      Number(startYM.slice(0, 4)),
      Number(startYM.slice(5, 7)) - 1,
      1
    );
    rangeEnd = ymToDateEnd(endYM);
  } else {
    const y = year || new Date().getFullYear();
    rangeStart = new Date(y, 0, 1);
    rangeEnd = new Date(y, Math.min(11, horizon - 1), 0);
  }

  const [changes, bonuses] = await Promise.all([
    prisma.incomeChange.findMany({
      where: { userId: user.id, city, effectiveFrom: { lte: rangeEnd } },
      orderBy: { effectiveFrom: "asc" },
    }),
    prisma.bonusPlan.findMany({
      where: {
        userId: user.id,
        city,
        effectiveDate: { gte: rangeStart, lte: rangeEnd },
      },
      orderBy: { effectiveDate: "asc" },
    }),
  ]);

  async function paramsForMonth(
    y: number,
    m: number
  ): Promise<TaxParams | null> {
    const yearKey = `tax:${city}:${y}`;
    let records = await prisma.config.findMany({
      where: { key: yearKey },
      orderBy: { effectiveFrom: "asc" },
    });
    // 若没有该年的记录：尝试自动引导（杭州）
    if (!records.length && city === "Hangzhou") {
      const params = await fetchHangzhouParams({ year: y, city });
      await prisma.config.create({
        data: {
          key: yearKey,
          value: JSON.stringify(params),
          effectiveFrom: new Date(`${y}-01-01`),
        },
      });
      records = await prisma.config.findMany({
        where: { key: yearKey },
        orderBy: { effectiveFrom: "asc" },
      });
    }
    const monthEnd = new Date(y, m, 0).getTime();
    let pick: any = null;
    for (const r of records) {
      if (r.effectiveFrom.getTime() <= monthEnd) pick = r;
    }
    if (!pick) return null;
    try {
      return normalizeTaxParamsValue(pick.value as string);
    } catch {
      return null;
    }
  }

  try {
    const months = iterateMonths(rangeStart, rangeEnd);
    function grossForMonth(y: number, m: number): number {
      const end = new Date(y, m, 0).getTime();
      let g = 0;
      for (const c of changes)
        if (c.effectiveFrom.getTime() <= end) g = Number(c.grossMonthly);
      return g;
    }
    function bonusForMonth(y: number, m: number): number | undefined {
      let s = 0;
      for (const b of bonuses) {
        const d = b.effectiveDate;
        if (d.getFullYear() === y && d.getMonth() + 1 === m)
          s += Number(b.amount);
      }
      return s || undefined;
    }
    const monthParams: (TaxParams | null)[] = [];
    for (const it of months) monthParams.push(await paramsForMonth(it.y, it.m));
    if (monthParams.some((p) => p == null))
      return NextResponse.json(
        { error: "tax params missing for some months" },
        { status: 400 }
      );
    const base = monthParams[0]!;
    const inputs = months.map((it, idx) => ({
      month: it.m,
      gross: grossForMonth(it.y, it.m),
      bonus: bonusForMonth(it.y, it.m),
      overrides: monthParams[idx] || undefined,
    }));
    const results = calcMonthlyWithholdingCumulative(inputs, base, {
      mergeBonusIntoComprehensive: true,
    });
    const changeMonths = new Set(
      changes.map(
        (c) =>
          c.effectiveFrom.getFullYear() * 100 + (c.effectiveFrom.getMonth() + 1)
      )
    );
    const bonusMonths = new Set(
      bonuses.map(
        (b) =>
          b.effectiveDate.getFullYear() * 100 + (b.effectiveDate.getMonth() + 1)
      )
    );
    const taxMonths = new Set(
      months
        .filter(
          (_, i) =>
            i > 0 &&
            JSON.stringify(monthParams[i]!.brackets) !==
              JSON.stringify(monthParams[i - 1]!.brackets)
        )
        .map((it) => it.y * 100 + it.m)
    );
    const annotated = results.map((r, i) => ({
      ...r,
      markers: {
        salaryChange: changeMonths.has(months[i].y * 100 + months[i].m),
        bonusPaid: bonusMonths.has(months[i].y * 100 + months[i].m),
        taxChange: taxMonths.has(months[i].y * 100 + months[i].m),
      },
      ym: `${months[i].y}-${String(months[i].m).padStart(2, "0")}`,
    }));
    return NextResponse.json({ results: annotated });
  } catch (err: unknown) {
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
