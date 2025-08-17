import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { createTaxService } from "@/lib/tax";
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
  try {
    const userId = await getCurrentUser(req);
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
        where: { userId, city, effectiveFrom: { lte: rangeEnd } },
        orderBy: { effectiveFrom: "asc" },
      }),
      prisma.bonusPlan.findMany({
        where: {
          userId,
          city,
          effectiveDate: { gte: rangeStart, lte: rangeEnd },
        },
        orderBy: { effectiveDate: "asc" },
      }),
    ]);

    const taxService = createTaxService(prisma);

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
    // 方案B：调用服务层计算累计预扣
    // 自动导入杭州配置（若缺失）
    for (const it of months) {
      const cfg = await taxService.getCurrentTaxConfig(city, it.endDate);
      if (
        (!cfg?.taxBrackets?.length || !cfg?.socialInsurance) &&
        city === "Hangzhou"
      ) {
        const params = await fetchHangzhouParams({ year: it.y, city });
        await taxService.importHangzhouParams(params as any);
      }
    }
    const results = await taxService.calculateForecastWithholdingCumulative({
      city,
      months: months.map((it) => ({
        year: it.y,
        month: it.m,
        gross: grossForMonth(it.y, it.m),
        bonus: bonusForMonth(it.y, it.m) || 0,
      })),
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
      results
        .map((r, i, arr) =>
          i === 0 ? null : arr[i - 1].paramsSig !== r.paramsSig ? r.ym : null
        )
        .filter(Boolean)
        .map(
          (ym) =>
            Number(String(ym).slice(0, 4)) * 100 +
            Number(String(ym).slice(5, 7))
        )
    );
    const annotated = results.map((r, i) => ({
      ...r,
      markers: {
        salaryChange: changeMonths.has(months[i].y * 100 + months[i].m),
        bonusPaid: bonusMonths.has(months[i].y * 100 + months[i].m),
        taxChange: taxMonths.has(months[i].y * 100 + months[i].m),
      },
      ym: `${months[i].y}-${String(months[i].m).padStart(2, "0")}`,
      salaryThisMonth: grossForMonth(months[i].y, months[i].m) || 0,
      bonusThisMonth: bonusForMonth(months[i].y, months[i].m) || 0,
    }));
    // 汇总
    const totals = annotated.reduce(
      (acc: any, x: any) => {
        acc.totalSalary += Number(x.salaryThisMonth || 0);
        acc.totalBonus += Number(x.bonusThisMonth || 0);
        acc.totalGross += Number(x.grossThisMonth || 0);
        acc.totalNet += Number(x.net || 0);
        acc.totalTax += Number(x.taxThisMonth || 0);
        return acc;
      },
      { totalSalary: 0, totalBonus: 0, totalGross: 0, totalNet: 0, totalTax: 0 }
    );
    return NextResponse.json({ results: annotated, totals });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
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
