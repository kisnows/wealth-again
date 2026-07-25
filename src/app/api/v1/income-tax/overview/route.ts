import { type NextRequest, NextResponse } from "next/server";
import db from "@/server/db";
import { incomeRecords, users } from "@/server/db/schema";
import { getUserFromRequest } from "@/server/utils/auth";
import { and, asc, eq, gte, lte } from "drizzle-orm";

/**
 * GET /api/v1/income-tax/overview?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&cityId=optional
 * - 获取指定时间范围内的收入概况统计
 * - 返回: OverviewStats
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "startDate and endDate are required" },
      { status: 400 },
    );
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const userId = user.id;
    const [userRecord] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 获取收入记录
    const incomeRecords = await db
      .select()
      .from(incomeRecords)
      .where(
        and(
          eq(incomeRecords.userId, userId),
          gte(incomeRecords.monthDate, new Date(startDate)),
          lte(incomeRecords.monthDate, new Date(endDate)),
        ),
      )
      .orderBy(asc(incomeRecords.monthDate));

    if (incomeRecords.length === 0) {
      return NextResponse.json({
        totalGrossIncome: 0,
        totalNetIncome: 0,
        totalSocialInsurance: 0,
        totalHousingFund: 0,
        totalTax: 0,
        averageTaxRate: 0,
        monthlyAverage: 0,
        yearOverYearGrowth: 0,
        monthsCount: 0,
        currency: userRecord.displayCurrency ?? "CNY",
        period: `${startDate} 至 ${endDate}`,
      });
    }

    // 计算汇总统计
    const toNumber = (value: string | number | null | undefined) =>
      Number(value ?? 0);
    const totals = incomeRecords.reduce(
      (acc, record) => ({
        grossIncome:
          acc.grossIncome +
          toNumber(record.gross) +
          toNumber(record.bonus) +
          toNumber(record.ltcIncome) +
          toNumber(record.equityIncome),
        netIncome: acc.netIncome + toNumber(record.netIncome),
        socialInsurance: acc.socialInsurance + toNumber(record.socialInsurance),
        housingFund: acc.housingFund + toNumber(record.housingFund),
        tax: acc.tax + toNumber(record.incomeTax),
      }),
      {
        grossIncome: 0,
        netIncome: 0,
        socialInsurance: 0,
        housingFund: 0,
        tax: 0,
      },
    );

    const monthsCount = incomeRecords.length;
    const averageTaxRate =
      totals.grossIncome > 0 ? totals.tax / totals.grossIncome : 0;
    const monthlyAverage = monthsCount > 0 ? totals.netIncome / monthsCount : 0;

    // 计算同比增长率（简化版本）
    let yearOverYearGrowth = 0;
    if (monthsCount >= 2) {
      const firstHalf = incomeRecords.slice(0, Math.floor(monthsCount / 2));
      const secondHalf = incomeRecords.slice(Math.floor(monthsCount / 2));

      const firstHalfAvg =
        firstHalf.reduce((sum, record) => sum + toNumber(record.netIncome), 0) /
        firstHalf.length;
      const secondHalfAvg =
        secondHalf.reduce(
          (sum, record) => sum + toNumber(record.netIncome),
          0,
        ) / secondHalf.length;

      if (firstHalfAvg > 0) {
        yearOverYearGrowth = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;
      }
    }

    const overviewStats = {
      totalGrossIncome: totals.grossIncome,
      totalNetIncome: totals.netIncome,
      totalSocialInsurance: totals.socialInsurance,
      totalHousingFund: totals.housingFund,
      totalTax: totals.tax,
      averageTaxRate,
      monthlyAverage,
      yearOverYearGrowth,
      monthsCount,
      currency: userRecord.displayCurrency ?? "CNY",
      period: `${startDate} 至 ${endDate}`,
    };

    return NextResponse.json(overviewStats);
  } catch (error) {
    console.error("Income overview error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
