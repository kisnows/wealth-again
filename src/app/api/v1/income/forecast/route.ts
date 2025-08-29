import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import { getUserFromRequest } from "@/server/utils/auth";

/**
 * GET /api/v1/income/forecast?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&cityId=optional
 * - 根据用户的工资变更、奖金、长期现金计划等，预测指定时间范围内的月度收入
 * - 返回: { items: ForecastResult[] }
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const cityId = searchParams.get("cityId");

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "startDate and endDate are required" },
      { status: 400 }
    );
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const userId = (user as any).id;
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      include: { currentCity: true },
    });

    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 使用指定城市或用户当前城市
    const targetCityId = cityId || userRecord.currentCityId;
    const currency = userRecord.baseCurrency;

    // 获取时间范围内的月份列表
    const months = getMonthsBetween(startDate, endDate);

    // 获取用户的收入数据
    const salaryChanges = await prisma.incomeChange.findMany({
      where: { userId },
      orderBy: { effectiveFrom: "asc" },
    });

    // 计算每月预测数据
    const forecastResults = months.map((month) => {
      const monthDate = new Date(month);

      // 获取当月工资
      const salary = getCurrentSalary(salaryChanges, monthDate);

      // 简化计算
      const bonus = 0; // 暂时设为0
      const longTermCash = 0; // 暂时设为0
      const equityIncome = 0; // 暂时设为0
      const grossIncome = salary + bonus + longTermCash + equityIncome;

      // 简化的社保和公积金计算
      const socialInsurance = salary * 0.08; // 8%
      const housingFund = salary * 0.12; // 12%

      // 简化的个税计算
      const incomeTax = calculateIncomeTax(
        grossIncome,
        socialInsurance,
        housingFund
      );

      const netIncome = grossIncome - socialInsurance - housingFund - incomeTax;
      const taxRate = grossIncome > 0 ? incomeTax / grossIncome : 0;

      return {
        month,
        salary,
        bonus,
        longTermCash,
        equityIncome,
        grossIncome,
        socialInsurance,
        housingFund,
        incomeTax,
        netIncome,
        taxRate,
        currency,
      };
    });

    return NextResponse.json({ items: forecastResults });
  } catch (error) {
    console.error("Income forecast error:", error);
    return NextResponse.json(
      { error: "Failed to calculate income forecast" },
      { status: 500 }
    );
  }
}

// 辅助函数：获取两个日期之间的月份列表
function getMonthsBetween(startDate: string, endDate: string): string[] {
  const months: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  const current = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  while (current <= endMonth) {
    months.push(current.toISOString().slice(0, 10));
    current.setMonth(current.getMonth() + 1);
  }

  return months;
}

// 辅助函数：获取指定月份的当前工资
function getCurrentSalary(salaryChanges: any[], monthDate: Date): number {
  const applicableChanges = salaryChanges.filter(
    (change) => new Date(change.effectiveFrom) <= monthDate
  );

  if (applicableChanges.length === 0) return 0;

  // 获取最新的工资变更
  const latestChange = applicableChanges[applicableChanges.length - 1];
  return latestChange.grossMonthly || 0;
}

// 辅助函数：计算个税（简化版）
function calculateIncomeTax(
  grossIncome: number,
  socialInsurance: number,
  housingFund: number
): number {
  const taxableIncome = grossIncome - socialInsurance - housingFund - 5000; // 5000为个税起征点

  if (taxableIncome <= 0) return 0;

  // 简化的个税计算（使用固定税率）
  if (taxableIncome <= 3000) return taxableIncome * 0.03;
  if (taxableIncome <= 12000) return taxableIncome * 0.1 - 210;
  if (taxableIncome <= 25000) return taxableIncome * 0.2 - 1410;

  return taxableIncome * 0.25 - 2660;
}
