import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { createTaxService } from "@/lib/tax";
import { ZodError } from "zod";
import { fetchHangzhouParams } from "@/lib/sources/hz-params";
import { convertCurrency } from "@/lib/currency";
import { getUserCitiesInRange } from "@/lib/user-city";

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
    // 获取用户信息以获取基准币种
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    const { searchParams } = new URL(req.url);
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

    // 获取用户在时间范围内的城市变更情况
    const userCities = await getUserCitiesInRange(userId, rangeStart, rangeEnd);
    const representativeCity = userCities.length > 0 ? userCities[0].city : "Hangzhou";

    // 查询收入相关数据（不再按城市过滤，因为这些表已经移除了city字段）
    const [changes, bonuses, longTermCash] = await Promise.all([
      prisma.incomeChange.findMany({
        where: { userId, effectiveFrom: { lte: rangeEnd } },
        orderBy: { effectiveFrom: "asc" },
      }),
      prisma.bonusPlan.findMany({
        where: {
          userId,
          effectiveDate: { gte: rangeStart, lte: rangeEnd },
        },
        orderBy: { effectiveDate: "asc" },
      }),
      prisma.longTermCash.findMany({
        where: {
          userId,
          effectiveDate: { lte: rangeEnd },
        },
        orderBy: { effectiveDate: "asc" },
      }),
    ]);

    const taxService = createTaxService(prisma);

    const months = iterateMonths(rangeStart, rangeEnd);
    // 获取用户基准币种（默认人民币）
    const baseCurrency = user?.baseCurrency || "CNY";
    
    async function convertToBaseCurrency(amount: number, fromCurrency: string, date: Date): Promise<number> {
      if (fromCurrency === baseCurrency) {
        return amount;
      }
      return await convertCurrency(amount, fromCurrency, baseCurrency, date);
    }
    
    async function grossForMonth(y: number, m: number): Promise<number> {
      const end = new Date(y, m, 0);
      let g = 0;
      for (const c of changes) {
        if (c.effectiveFrom.getTime() <= end.getTime()) {
          // 转换币种到基准币种
          g = await convertToBaseCurrency(Number(c.grossMonthly), c.currency, end);
        }
      }
      return g;
    }
    
    async function bonusForMonth(y: number, m: number): Promise<number> {
      const end = new Date(y, m, 0);
      let s = 0;
      for (const b of bonuses) {
        const d = b.effectiveDate;
        if (d.getFullYear() === y && d.getMonth() + 1 === m) {
          // 转换币种到基准币种
          s += await convertToBaseCurrency(Number(b.amount), b.currency, end);
        }
      }
      return s;
    }
    
    // 计算长期现金在指定月份的发放金额和笔数
    async function longTermCashForMonth(y: number, m: number): Promise<{ amount: number, count: number }> {
      const end = new Date(y, m, 0);
      let amount = 0;
      let count = 0;
      for (const ltc of longTermCash) {
        // 检查是否在发放期内（每年1、4、7、10月）
        if ([1, 4, 7, 10].includes(m)) {
          // 计算生效日期与当前日期的季度差
          const startDate = new Date(ltc.effectiveDate);
          const currentDate = new Date(y, m - 1, 1); // 月份从0开始
          
          // 计算季度数（每年4个季度）
          const startYear = startDate.getFullYear();
          const startMonth = startDate.getMonth();
          const currentYear = currentDate.getFullYear();
          const currentMonth = currentDate.getMonth();
          
          const startQuarter = Math.floor(startMonth / 3);
          const currentQuarter = Math.floor(currentMonth / 3);
          
          const quartersDiff = 
            (currentYear - startYear) * 4 + 
            (currentQuarter - startQuarter);
          
          // 检查是否在16个季度的发放期内
          if (quartersDiff >= 0 && quartersDiff < 16) {
            // 计算每季度应发放的金额并转换币种
            const quarterlyAmount = Number(ltc.totalAmount) / 16;
            amount += await convertToBaseCurrency(quarterlyAmount, ltc.currency, end);
            count++;
          }
        }
      }
      return { amount, count };
    }

    // 自动导入税务配置（如果缺失）
    // 这里使用代表性城市检查，实际计算会动态查询每个月的城市
    for (const it of months) {
      const cfg = await taxService.getCurrentTaxConfig(representativeCity, it.endDate);
      if (
        (!cfg?.taxBrackets?.length || !cfg?.socialInsurance) &&
        representativeCity === "Hangzhou"
      ) {
        const params = await fetchHangzhouParams({ year: it.y, city: representativeCity });
        await taxService.importHangzhouParams(params as any);
      }
    }
    
    // 计算每个月的收入并转换为基准币种
    const monthlyData: any[] = [];
    const monthlyValues: any[] = []; // 存储每月的具体值用于后续映射
    
    for (const it of months) {
      const gross = await grossForMonth(it.y, it.m);
      const bonus = await bonusForMonth(it.y, it.m);
      const longTermCashInfo = await longTermCashForMonth(it.y, it.m);
      
      monthlyData.push({
        year: it.y,
        month: it.m,
        gross: gross,
        bonus: bonus + longTermCashInfo.amount,
        longTermCashAmount: longTermCashInfo.amount,
        longTermCashCount: longTermCashInfo.count
      });
      
      monthlyValues.push({
        gross: gross,
        bonus: bonus,
        longTermCash: longTermCashInfo
      });
    }
    
    // 使用新的API签名，传入userId而不是city
    const results = await taxService.calculateForecastWithholdingCumulative({
      userId,
      months: monthlyData,
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
        longTermCashPaid: monthlyValues[i].longTermCash.count > 0 ? true : undefined,
        taxChange: taxMonths.has(months[i].y * 100 + months[i].m),
      },
      ym: `${months[i].y}-${String(months[i].m).padStart(2, "0")}`,
      salaryThisMonth: monthlyValues[i].gross || 0,
      bonusThisMonth: (monthlyValues[i].bonus || 0) + (monthlyValues[i].longTermCash.amount || 0),
      longTermCashThisMonth: monthlyValues[i].longTermCash.amount || 0,
      longTermCashCount: monthlyValues[i].longTermCash.count || 0,
    }));
    
    // 汇总
    const totals = annotated.reduce(
      (acc: any, x: any) => {
        acc.totalSalary += Number(x.salaryThisMonth || 0);
        acc.totalBonus += Number(x.bonusThisMonth || 0);
        acc.totalLongTermCash += Number(x.longTermCashThisMonth || 0);
        acc.totalGross += Number(x.grossThisMonth || 0);
        acc.totalNet += Number(x.net || 0);
        acc.totalTax += Number(x.taxThisMonth || 0);
        return acc;
      },
      { totalSalary: 0, totalBonus: 0, totalLongTermCash: 0, totalGross: 0, totalNet: 0, totalTax: 0 }
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
