import type { City, CityChangeRecord, IncomeChange } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import { getUserFromRequest } from "@/server/utils/auth";

type MonthlyResult = {
  month: string;
  salary: number;
  bonus: number;
  longTermCash: number;
  equityIncome: number;
  grossIncome: number;
  socialInsurance: number;
  housingFund: number;
  monthlyTaxableIncome: number;
  currency: string;
};

/**
 * GET /api/v1/income/forecast?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&cityId=optional
 * - 根据用户的工资变更、奖金、长期现金计划等，预测指定时间范围内的月度收入
 * - 返回: { items: ForecastResult[] }
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
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      include: { currentCity: true },
    });

    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 使用指定城市或用户当前城市
    const currency = userRecord.displayCurrency ?? "CNY";

    // 获取时间范围内的月份列表
    const months = getMonthsBetween(startDate, endDate);

    // 获取用户的收入数据
    const salaryChanges = await prisma.incomeChange.findMany({
      where: { userId },
      orderBy: { effectiveFrom: "asc" },
    });

    // 获取用户的城市变更记录
    const cityChanges = await prisma.cityChangeRecord.findMany({
      where: { userId },
      include: { toCity: true },
      orderBy: { effectiveMonth: "asc" },
    });

    // 获取奖金计划
    const bonusPlans = await prisma.bonusPlan.findMany({
      where: {
        userId,
        effectiveDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
    });

    // 获取长期现金计划和支付记录
    const ltcPayouts = await prisma.longTermCashPayout.findMany({
      where: {
        plan: { userId },
        payDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
    });

    // 获取股权归属记录
    const equityVests = await prisma.equityVest.findMany({
      where: {
        grant: { userId },
        vestDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
        fairValue: { not: null },
      },
    });

    // 计算每月预测数据
    const monthlyResults: MonthlyResult[] = await Promise.all(
      months.map(async (month) => {
        const monthDate = new Date(month);
        const nextMonthStart = new Date(
          monthDate.getFullYear(),
          monthDate.getMonth() + 1,
          1,
        );

        // 获取当月工资
        const salary = getCurrentSalary(salaryChanges, monthDate);

        // 获取当月奖金
        const bonus = bonusPlans
          .filter((b) => {
            const effectiveDate = new Date(b.effectiveDate);
            return effectiveDate >= monthDate && effectiveDate < nextMonthStart;
          })
          .reduce((sum, b) => sum + toNumber(b.amount), 0);

        // 获取当月长期现金
        const longTermCash = ltcPayouts
          .filter((p) => {
            const payDate = new Date(p.payDate);
            return payDate >= monthDate && payDate < nextMonthStart;
          })
          .reduce((sum, p) => sum + toNumber(p.amount), 0);

        // 获取当月股权收入
        const equityIncome = equityVests
          .filter((v) => {
            const vestDate = new Date(v.vestDate);
            return vestDate >= monthDate && vestDate < nextMonthStart;
          })
          .reduce((sum, v) => sum + toNumber(v.fairValue), 0);

        const grossIncome = salary + bonus + longTermCash + equityIncome;

        // 根据城市变更记录确定当月城市
        const monthCityId = getCityForMonth(
          cityChanges,
          monthDate,
          userRecord.currentCityId,
        );

        // 获取社保规则
        const ssRule = await prisma.cityRuleSS.findFirst({
          where: {
            cityId: monthCityId,
            effectiveFrom: { lte: monthDate },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: monthDate } }],
          },
          orderBy: { effectiveFrom: "desc" },
        });

        // 获取公积金规则
        const hfRule = await prisma.cityRuleHF.findFirst({
          where: {
            cityId: monthCityId,
            effectiveFrom: { lte: monthDate },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: monthDate } }],
          },
          orderBy: { effectiveFrom: "desc" },
        });

        // 计算社保和公积金
        const clamp = (x: number, min: number, max: number) =>
          Math.max(min, Math.min(max, x));

        const ssBase = ssRule
          ? clamp(salary, toNumber(ssRule.baseMin), toNumber(ssRule.baseMax))
          : 0;
        const hfBase = hfRule
          ? clamp(salary, toNumber(hfRule.baseMin), toNumber(hfRule.baseMax))
          : 0;

        const pension = ssRule ? ssBase * toNumber(ssRule.ratePension) : 0;
        const medical = ssRule
          ? ssBase * toNumber(ssRule.rateMedical) +
            toNumber(ssRule.fixedMedicalPersonal)
          : 0;
        const unemployment = ssRule
          ? ssBase * toNumber(ssRule.rateUnemployment)
          : 0;
        const socialInsurance = pension + medical + unemployment;
        const housingFund = hfRule ? hfBase * toNumber(hfRule.rateEmployee) : 0;

        // 获取税制配置
        const taxYear = monthDate.getFullYear();
        const taxConfig = await prisma.taxConfig.findUnique({
          where: {
            country_taxYear: {
              country: userRecord.currentCity.country,
              taxYear,
            },
          },
        });

        const standardDeduction =
          toNumber(taxConfig?.standardDeduction) || 5000;
        const specialAdditionalDeduction = toNumber(
          taxConfig?.specialAdditionalDeduction,
        );

        // 计算当月应税收入
        const monthlyTaxableIncome = Math.max(
          0,
          grossIncome -
            socialInsurance -
            housingFund -
            standardDeduction -
            specialAdditionalDeduction,
        );

        return {
          month,
          salary,
          bonus,
          longTermCash,
          equityIncome,
          grossIncome,
          socialInsurance,
          housingFund,
          monthlyTaxableIncome, // 临时字段，用于后续税收计算
          currency,
        };
      }),
    );

    // 首先需要计算年初到查询起始月之前的累计应税收入
    const queryStartDate = new Date(startDate);
    const yearStart = new Date(queryStartDate.getFullYear(), 0, 1);

    let priorYearTaxableIncome = 0;
    if (queryStartDate > yearStart) {
      // 获取年初到查询开始前的月份
      const priorMonths = getMonthsBetween(
        yearStart.toISOString().slice(0, 10),
        new Date(queryStartDate.getTime() - 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
      );

      // 计算年初到查询开始前的累计应税收入
      for (const priorMonth of priorMonths) {
        const priorMonthDate = new Date(priorMonth);
        const priorSalary = getCurrentSalary(salaryChanges, priorMonthDate);

        const priorMonthCityId = getCityForMonth(
          cityChanges,
          priorMonthDate,
          userRecord.currentCityId,
        );

        // 获取历史社保规则
        const priorSsRule = await prisma.cityRuleSS.findFirst({
          where: {
            cityId: priorMonthCityId,
            effectiveFrom: { lte: priorMonthDate },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: priorMonthDate } }],
          },
          orderBy: { effectiveFrom: "desc" },
        });

        // 获取历史公积金规则
        const priorHfRule = await prisma.cityRuleHF.findFirst({
          where: {
            cityId: priorMonthCityId,
            effectiveFrom: { lte: priorMonthDate },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: priorMonthDate } }],
          },
          orderBy: { effectiveFrom: "desc" },
        });

        // 获取历史税制配置
        const priorTaxYear = priorMonthDate.getFullYear();
        const priorTaxConfig = await prisma.taxConfig.findUnique({
          where: {
            country_taxYear: {
              country: userRecord.currentCity.country,
              taxYear: priorTaxYear,
            },
          },
        });

        const priorStandardDeduction =
          toNumber(priorTaxConfig?.standardDeduction) || 5000;
        const priorSpecialAdditionalDeduction = toNumber(
          priorTaxConfig?.specialAdditionalDeduction,
        );

        // 计算历史社保和公积金
        const clamp = (x: number, min: number, max: number) =>
          Math.max(min, Math.min(max, x));

        const priorSsBase = priorSsRule
          ? clamp(
              priorSalary,
              toNumber(priorSsRule.baseMin),
              toNumber(priorSsRule.baseMax),
            )
          : 0;
        const priorHfBase = priorHfRule
          ? clamp(
              priorSalary,
              toNumber(priorHfRule.baseMin),
              toNumber(priorHfRule.baseMax),
            )
          : 0;

        const priorPension = priorSsRule
          ? priorSsBase * toNumber(priorSsRule.ratePension)
          : 0;
        const priorMedical = priorSsRule
          ? priorSsBase * toNumber(priorSsRule.rateMedical) +
            toNumber(priorSsRule.fixedMedicalPersonal)
          : 0;
        const priorUnemployment = priorSsRule
          ? priorSsBase * toNumber(priorSsRule.rateUnemployment)
          : 0;
        const priorSocialInsurance =
          priorPension + priorMedical + priorUnemployment;
        const priorHousingFund = priorHfRule
          ? priorHfBase * toNumber(priorHfRule.rateEmployee)
          : 0;

        // 计算历史应税收入
        const priorMonthlyTaxableIncome = Math.max(
          0,
          priorSalary -
            priorSocialInsurance -
            priorHousingFund -
            priorStandardDeduction -
            priorSpecialAdditionalDeduction,
        );

        priorYearTaxableIncome += priorMonthlyTaxableIncome;
      }
    }

    // 计算累计字段和个税
    const forecastResults = monthlyResults.map((result, index) => {
      // 计算从第一个月到当前月的累计值（仅查询范围内）
      const cumulativeGrossIncome = monthlyResults
        .slice(0, index + 1)
        .reduce((sum, r) => sum + r.grossIncome, 0);

      const cumulativeSocialInsurance = monthlyResults
        .slice(0, index + 1)
        .reduce((sum, r) => sum + r.socialInsurance, 0);

      const cumulativeHousingFund = monthlyResults
        .slice(0, index + 1)
        .reduce((sum, r) => sum + r.housingFund, 0);

      // 计算年初至当前月的累计应税收入（包含年初到查询开始前的部分）
      const queryRangeTaxableIncome = monthlyResults
        .slice(0, index + 1)
        .reduce((sum, r) => sum + r.monthlyTaxableIncome, 0);

      const yearToDateTaxableIncome =
        priorYearTaxableIncome + queryRangeTaxableIncome;

      // 基于年初至今累计应税收入计算累计个税
      const yearToDateIncomeTax = calculateAnnualIncomeTax(
        yearToDateTaxableIncome,
      );

      // 计算年初到上月的累计个税
      const priorYearToDateTaxableIncome =
        index > 0
          ? priorYearTaxableIncome +
            monthlyResults
              .slice(0, index)
              .reduce((sum, r) => sum + r.monthlyTaxableIncome, 0)
          : priorYearTaxableIncome;

      const previousYearToDateTax = calculateAnnualIncomeTax(
        priorYearToDateTaxableIncome,
      );

      // 当月个税 = 年初至今累计个税 - 年初至上月累计个税
      const monthlyIncomeTax = yearToDateIncomeTax - previousYearToDateTax;

      // 查询范围内的累计个税
      const cumulativeIncomeTax = monthlyResults
        .slice(0, index + 1)
        .reduce((sum, _, i) => {
          const iYearToDateTaxable =
            priorYearTaxableIncome +
            monthlyResults
              .slice(0, i + 1)
              .reduce((s, r) => s + r.monthlyTaxableIncome, 0);
          const iPrevYearToDateTaxable =
            i > 0
              ? priorYearTaxableIncome +
                monthlyResults
                  .slice(0, i)
                  .reduce((s, r) => s + r.monthlyTaxableIncome, 0)
              : priorYearTaxableIncome;
          return (
            sum +
            (calculateAnnualIncomeTax(iYearToDateTaxable) -
              calculateAnnualIncomeTax(iPrevYearToDateTaxable))
          );
        }, 0);

      // 计算当月税后收入
      const netIncome =
        result.grossIncome -
        result.socialInsurance -
        result.housingFund -
        monthlyIncomeTax;

      // 计算累计税后收入
      const cumulativeNetIncome = monthlyResults
        .slice(0, index + 1)
        .reduce((sum, r, i) => {
          const monthTax = (() => {
            if (i === index) return monthlyIncomeTax;
            const taxableToCurrent =
              priorYearTaxableIncome +
              monthlyResults
                .slice(0, i + 1)
                .reduce((s, mr) => s + mr.monthlyTaxableIncome, 0);
            const taxableToPrevious =
              i > 0
                ? priorYearTaxableIncome +
                  monthlyResults
                    .slice(0, i)
                    .reduce((s, mr) => s + mr.monthlyTaxableIncome, 0)
                : priorYearTaxableIncome;
            return (
              calculateAnnualIncomeTax(taxableToCurrent) -
              calculateAnnualIncomeTax(taxableToPrevious)
            );
          })();
          return (
            sum + (r.grossIncome - r.socialInsurance - r.housingFund - monthTax)
          );
        }, 0);

      // 计算边际税率（基于年初至今累计应税收入确定税率档位）
      let marginalTaxRate = 0;
      if (yearToDateTaxableIncome > 0) {
        if (yearToDateTaxableIncome <= 36000) {
          marginalTaxRate = 0.03;
        } else if (yearToDateTaxableIncome <= 144000) {
          marginalTaxRate = 0.1;
        } else if (yearToDateTaxableIncome <= 300000) {
          marginalTaxRate = 0.2;
        } else if (yearToDateTaxableIncome <= 420000) {
          marginalTaxRate = 0.25;
        } else if (yearToDateTaxableIncome <= 660000) {
          marginalTaxRate = 0.3;
        } else if (yearToDateTaxableIncome <= 960000) {
          marginalTaxRate = 0.35;
        } else {
          marginalTaxRate = 0.45;
        }
      }

      // 使用边际税率
      const taxRate = marginalTaxRate;

      // 移除临时字段并添加计算字段
      const { monthlyTaxableIncome: _monthlyTaxableIncome, ...finalResult } =
        result;

      return {
        ...finalResult,
        incomeTax: monthlyIncomeTax,
        netIncome,
        taxRate,
        cumulativeGrossIncome,
        cumulativeNetIncome,
        cumulativeSocialInsurance,
        cumulativeHousingFund,
        cumulativeIncomeTax,
      };
    });

    return NextResponse.json({ items: forecastResults });
  } catch (error) {
    console.error("Income forecast error:", error);
    return NextResponse.json(
      { error: "Failed to calculate income forecast" },
      { status: 500 },
    );
  }
}

// 辅助函数：安全转换 Prisma Decimal 到 number
function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  if (typeof value === "object" && value !== null) {
    // Prisma Decimal 对象
    return Number(value.toString()) || 0;
  }
  return Number(value) || 0;
}

// 辅助函数：根据城市变更记录获取指定月份的城市ID
type CityChangeRecordWithCity = CityChangeRecord & { toCity: City };

function getCityForMonth(
  cityChanges: CityChangeRecordWithCity[],
  monthDate: Date,
  defaultCityId: string,
): string {
  if (!cityChanges || cityChanges.length === 0) {
    return defaultCityId;
  }
  const sorted = [...cityChanges].sort(
    (a, b) =>
      new Date(a.effectiveMonth).getTime() -
      new Date(b.effectiveMonth).getTime(),
  );
  const monthStart = new Date(
    Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), 1),
  );
  let currentCity = sorted[0]?.fromCityId || defaultCityId;
  for (const change of sorted) {
    const effectiveStart = new Date(change.effectiveMonth);
    const effectiveMonthStart = new Date(
      Date.UTC(
        effectiveStart.getUTCFullYear(),
        effectiveStart.getUTCMonth(),
        1,
      ),
    );
    if (monthStart >= effectiveMonthStart) {
      currentCity = change.toCityId;
    } else {
      break;
    }
  }
  return currentCity || defaultCityId;
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
function getCurrentSalary(
  salaryChanges: IncomeChange[],
  monthDate: Date,
): number {
  const applicableChanges = salaryChanges.filter(
    (change) => new Date(change.effectiveFrom) <= monthDate,
  );

  if (applicableChanges.length === 0) return 0;

  // 获取最新的工资变更
  const latestChange = applicableChanges[applicableChanges.length - 1];
  return toNumber(latestChange.grossMonthly);
}

// 辅助函数：根据年度累计应纳税所得额计算个税（使用中国税率表）
function calculateAnnualIncomeTax(annualTaxableIncome: number): number {
  if (annualTaxableIncome <= 0) return 0;

  // 中国2025年个人所得税税率表（年度累计）
  if (annualTaxableIncome <= 36000) {
    return annualTaxableIncome * 0.03;
  } else if (annualTaxableIncome <= 144000) {
    return annualTaxableIncome * 0.1 - 2520;
  } else if (annualTaxableIncome <= 300000) {
    return annualTaxableIncome * 0.2 - 16920;
  } else if (annualTaxableIncome <= 420000) {
    return annualTaxableIncome * 0.25 - 31920;
  } else if (annualTaxableIncome <= 660000) {
    return annualTaxableIncome * 0.3 - 52920;
  } else if (annualTaxableIncome <= 960000) {
    return annualTaxableIncome * 0.35 - 85920;
  } else {
    return annualTaxableIncome * 0.45 - 181920;
  }
}
