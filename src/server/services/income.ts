import type { IncomeRecord } from "@prisma/client";
import prisma from "@/server/db";
import { logAudit } from "@/server/services/audit";
import { calculateTax } from "@/server/services/tax";

type RecalcParams = {
  taxYear: number;
  endMonth: number;
  startMonth?: number;
  cityId?: string;
  userId?: string;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const monthStartUTC = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

type CityChangeSnapshot = {
  effectiveMonth: Date;
  toCityId: string;
};

type CityMeta = {
  id: string;
  country: string;
};

const RECLAC_DELAY_MS = 10 * 60 * 1000;
const RECLAC_RETRY_DELAY_MS = 5 * 60 * 1000;

type ScheduleTaskParams = {
  userId?: string;
  taxYear: number;
  startMonth?: number;
  endMonth?: number;
  cityId?: string;
  triggeredBy?: string;
  delayMs?: number;
};

type ProcessResult = {
  taskId: string;
  status: "COMPLETED" | "FAILED";
  updated: number;
  error?: string;
};

function buildCityResolver(
  fallbackCityId: string,
  changes: CityChangeSnapshot[],
) {
  if (!fallbackCityId && changes.length === 0) {
    throw new Error("city_resolver_missing_fallback");
  }
  const sorted = [...changes].sort(
    (a, b) => a.effectiveMonth.getTime() - b.effectiveMonth.getTime(),
  );
  return (monthDate: Date) => {
    let currentCity = fallbackCityId;
    for (const change of sorted) {
      const effectiveStart = monthStartUTC(change.effectiveMonth).getTime();
      if (monthStartUTC(monthDate).getTime() >= effectiveStart) {
        currentCity = change.toCityId;
      } else {
        break;
      }
    }
    return currentCity;
  };
}

export async function scheduleIncomeRecalcTask({
  userId,
  taxYear,
  startMonth = 1,
  endMonth = 12,
  cityId,
  triggeredBy,
  delayMs = RECLAC_DELAY_MS,
}: ScheduleTaskParams) {
  const now = new Date();
  const scheduledFor = new Date(now.getTime() + Math.max(delayMs, 0));
  const normalizedStart = Math.max(1, Math.min(12, startMonth));
  const normalizedEnd = Math.max(normalizedStart, Math.min(12, endMonth));

  if (userId) {
    const existing = await prisma.incomeRecalcTask.findFirst({
      where: {
        userId,
        taxYear,
        status: "PENDING",
      },
      orderBy: { scheduledFor: "asc" },
    });
    if (existing) {
      await prisma.incomeRecalcTask.update({
        where: { id: existing.id },
        data: {
          startMonth: Math.min(existing.startMonth, normalizedStart),
          endMonth: Math.max(existing.endMonth, normalizedEnd),
          cityId: cityId ?? existing.cityId,
          scheduledFor,
          triggeredBy: triggeredBy ?? existing.triggeredBy,
          updatedAt: now,
        },
      });
      return existing.id;
    }
  }

  const created = await prisma.incomeRecalcTask.create({
    data: {
      userId,
      taxYear,
      startMonth: normalizedStart,
      endMonth: normalizedEnd,
      cityId: cityId ?? null,
      status: "PENDING",
      scheduledFor,
      attempts: 0,
      triggeredBy: triggeredBy ?? null,
    },
  });
  await logAudit("INCOME_RECALC_TASK_SCHEDULED", {
    userId: userId ?? null,
    meta: {
      taskId: created.id,
      taxYear,
      startMonth: normalizedStart,
      endMonth: normalizedEnd,
      scheduledFor: scheduledFor.toISOString(),
    },
  });
  return created.id;
}

export async function listIncomeRecalcTasks(userId: string) {
  return prisma.incomeRecalcTask.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }],
    take: 50,
  });
}

export async function processDueIncomeRecalcTasks(limit = 5) {
  const now = new Date();
  const due = await prisma.incomeRecalcTask.findMany({
    where: {
      status: "PENDING",
      scheduledFor: { lte: now },
    },
    orderBy: { scheduledFor: "asc" },
    take: limit,
  });
  const results: ProcessResult[] = [];
  for (const task of due) {
    const claimed = await prisma.incomeRecalcTask.updateMany({
      where: { id: task.id, status: "PENDING" },
      data: {
        status: "RUNNING",
        attempts: task.attempts + 1,
        updatedAt: new Date(),
      },
    });
    if (!claimed.count) continue;
    try {
      const res = await recalcIncome({
        taxYear: task.taxYear,
        startMonth: task.startMonth,
        endMonth: task.endMonth,
        userId: task.userId ?? undefined,
        cityId: task.cityId ?? undefined,
      });
      await prisma.incomeRecalcTask.update({
        where: { id: task.id },
        data: {
          status: "COMPLETED",
          processedAt: new Date(),
          lastError: null,
          updatedAt: new Date(),
        },
      });
      await logAudit("INCOME_RECALC_TASK_COMPLETED", {
        userId: task.userId ?? null,
        meta: {
          taskId: task.id,
          taxYear: task.taxYear,
          startMonth: task.startMonth,
          endMonth: task.endMonth,
          updated: res.updated,
        },
      });
      results.push({ taskId: task.id, status: "COMPLETED", updated: res.updated });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "unknown error";
      await prisma.incomeRecalcTask.update({
        where: { id: task.id },
        data: {
          status: "FAILED",
          lastError: message,
          scheduledFor: new Date(Date.now() + RECLAC_RETRY_DELAY_MS),
          updatedAt: new Date(),
        },
      });
      await logAudit("INCOME_RECALC_TASK_FAILED", {
        userId: task.userId ?? null,
        meta: { taskId: task.id, error: message },
      });
      results.push({
        taskId: task.id,
        status: "FAILED",
        updated: 0,
        error: message,
      });
    }
  }
  return { processed: results.length, results };
}

export async function settleIncomeRecalcTasks({
  userId,
  taxYear,
}: {
  userId?: string | null;
  taxYear: number;
}) {
  if (!userId) return;
  await prisma.incomeRecalcTask.updateMany({
    where: {
      userId,
      taxYear,
      status: { in: ["PENDING", "RUNNING", "FAILED"] },
    },
    data: {
      status: "COMPLETED",
      processedAt: new Date(),
      lastError: null,
      updatedAt: new Date(),
    },
  });
}

export async function recalcIncome({
  taxYear,
  endMonth,
  startMonth = 1,
  cityId,
  userId,
}: RecalcParams) {
  if (endMonth < startMonth) return { updated: 0 as const };

  const users = await prisma.user.findMany({
    where: userId ? { id: userId } : undefined,
    include: { currentCity: true },
  });
  let updated = 0;

  for (const user of users) {
    const cityOverride = cityId ?? null;

    const cityChangeRepo = (prisma as any).cityChangeRecord;
    const cityChangesRaw =
      cityOverride ||
      !cityChangeRepo ||
      typeof cityChangeRepo.findMany !== "function"
        ? []
        : await cityChangeRepo.findMany({
            where: { userId: user.id },
            orderBy: { effectiveMonth: "asc" },
          });
    const cityChanges: CityChangeSnapshot[] = Array.isArray(cityChangesRaw)
      ? cityChangesRaw
      : [];

    const fallbackCityId =
      cityChanges[0]?.fromCityId ??
      user.currentCityId ??
      cityOverride ??
      cityChanges[0]?.toCityId ??
      "";
    if (!fallbackCityId) continue;

    const relevantCityIds = new Set<string>();
    if (user.currentCityId) relevantCityIds.add(user.currentCityId);
    if (cityOverride) relevantCityIds.add(cityOverride);
    cityChanges.forEach((change) => {
      relevantCityIds.add(change.toCityId);
      if (change.fromCityId) relevantCityIds.add(change.fromCityId);
    });

    const cityRepo = (prisma as any).city;
    const cityRecords =
      relevantCityIds.size > 0 &&
      cityRepo &&
      typeof cityRepo.findMany === "function"
        ? await cityRepo.findMany({
            where: { id: { in: Array.from(relevantCityIds) } },
            select: { id: true, country: true },
          })
        : [];
    const cityMap = new Map<string, CityMeta>(
      cityRecords.map((record) => [record.id, record]),
    );

    const fallbackCountry =
      user.currentCity?.country ??
      cityRecords.find((record) => record.id === user.currentCityId)?.country ??
      cityRecords[0]?.country ??
      (user.currentCity ? user.currentCity.country : undefined) ??
      "CN";
    const userCurrentCityMeta: CityMeta | null = user.currentCityId
      ? { id: user.currentCityId, country: fallbackCountry }
      : null;
    if (userCurrentCityMeta && !cityMap.has(userCurrentCityMeta.id)) {
      cityMap.set(userCurrentCityMeta.id, userCurrentCityMeta);
    }

    const resolveCity = cityOverride
      ? () => cityOverride
      : buildCityResolver(fallbackCityId, cityChanges);

    const representativeCityId =
      cityOverride ?? fallbackCityId ?? user.currentCityId;
    const representativeCity =
      representativeCityId != null
        ? (cityMap.get(representativeCityId) ?? {
            id: representativeCityId,
            country: fallbackCountry,
          })
        : null;
    if (!representativeCity) continue;

    const monthlyTaxables = new Array(12).fill(0);
    const monthlyCumTaxables = new Array(12).fill(0);
    const monthRecords: Array<{
      monthDate: Date;
      gross: number;
      bonus: number;
      ltcIncome: number;
      equityIncome: number;
      socialInsurance: number;
      housingFund: number;
      standard: number;
      special: number;
      cityId: string;
    } | null> = new Array(12).fill(null);

    const taxConfig =
      (await prisma.taxConfig.findFirst({
        where: {
          country: representativeCity.country,
          effectiveFrom: { lte: new Date(Date.UTC(taxYear, 11, 31)) },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gt: new Date(Date.UTC(taxYear, 0, 1)) } },
          ],
        },
        orderBy: { effectiveFrom: "desc" },
      })) ??
      (await prisma.taxConfig.findUnique({
        where: {
          country_taxYear: { country: representativeCity.country, taxYear },
        },
      }));
    if (!taxConfig) continue;
    const standard = Number(taxConfig.standardDeduction || 0);
    const configSpecial = Number(taxConfig.specialAdditionalDeduction || 0);
    let userAnnualDeduction: { annualAmount?: any } | null = null;
    const userAnnualRepo = (prisma as any).userAnnualDeduction;
    if (userAnnualRepo && typeof userAnnualRepo.findUnique === "function") {
      try {
        userAnnualDeduction = await userAnnualRepo.findUnique({
          where: { userId_taxYear: { userId: user.id, taxYear } },
        });
      } catch (_error) {
        userAnnualDeduction = null;
      }
    }
    const userSpecialMonthly = userAnnualDeduction
      ? Number(userAnnualDeduction.annualAmount || 0) / 12
      : 0;

    if (startMonth > 1) {
      const previousRecords = await prisma.incomeRecord.findMany({
        where: {
          userId: user.id,
          monthDate: {
            gte: new Date(Date.UTC(taxYear, 0, 1, 0, 0, 0)),
            lt: new Date(Date.UTC(taxYear, startMonth - 1, 1, 0, 0, 0)),
          },
        },
        orderBy: { monthDate: "asc" },
      });
      for (const record of previousRecords) {
        const idx = record.monthDate.getUTCMonth();
        monthlyTaxables[idx] = Number(record.taxableCurrent || 0);
        monthRecords[idx] = {
          monthDate: record.monthDate,
          gross: Number(record.gross || 0),
          bonus: Number(record.bonus || 0),
          ltcIncome: Number(record.ltcIncome || 0),
          equityIncome: Number(record.equityIncome || 0),
          socialInsurance: Number(record.socialInsurance || 0),
          housingFund: Number(record.housingFund || 0),
          standard,
          special: Number(record.specialDeductions || 0),
          cityId: record.cityId || resolveCity(record.monthDate),
        };
      }
    }

    for (let m = startMonth; m <= endMonth; m++) {
      const monthDate = new Date(Date.UTC(taxYear, m - 1, 1, 0, 0, 0));
      const nextMonthStart = new Date(Date.UTC(taxYear, m, 1, 0, 0, 0));
      const monthCityId = resolveCity(monthDate);

      const incomeChange = await prisma.incomeChange.findFirst({
        where: { userId: user.id, effectiveFrom: { lt: nextMonthStart } },
        orderBy: { effectiveFrom: "desc" },
      });
      const gross = Number(incomeChange?.grossMonthly || 0);

      const bonus = (
        await prisma.bonusPlan.findMany({
          where: {
            userId: user.id,
            effectiveDate: { gte: monthDate, lt: nextMonthStart },
          },
        })
      ).reduce((sum, item) => sum + Number(item.amount || 0), 0);

      const ltcIncome = (
        await prisma.longTermCashPayout.findMany({
          where: {
            plan: { userId: user.id },
            payDate: { gte: monthDate, lt: nextMonthStart },
          },
        })
      ).reduce((sum, item) => sum + Number(item.amount || 0), 0);

      const equityIncome = (
        await prisma.equityVest.findMany({
          where: {
            grant: { userId: user.id },
            vestDate: { gte: monthDate, lt: nextMonthStart },
            fairValue: { not: null },
          },
        })
      ).reduce((sum, item) => sum + Number(item.fairValue || 0), 0);

      const ssRule = await prisma.cityRuleSS.findFirst({
        where: {
          cityId: monthCityId,
          effectiveFrom: { lte: monthDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: monthDate } }],
        },
        orderBy: { effectiveFrom: "desc" },
      });
      const hfRule = await prisma.cityRuleHF.findFirst({
        where: {
          cityId: monthCityId,
          effectiveFrom: { lte: monthDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: monthDate } }],
        },
        orderBy: { effectiveFrom: "desc" },
      });

      const ssBase =
        ssRule && gross > 0
          ? clamp(gross, Number(ssRule.baseMin), Number(ssRule.baseMax))
          : 0;
      const hfBase =
        hfRule && gross > 0
          ? clamp(gross, Number(hfRule.baseMin), Number(hfRule.baseMax))
          : 0;
      const pension = ssRule ? ssBase * Number(ssRule.ratePension) : 0;
      const medical = ssRule
        ? ssBase * Number(ssRule.rateMedical) +
          Number(ssRule.fixedMedicalPersonal || 0)
        : 0;
      const unemployment = ssRule
        ? ssBase * Number(ssRule.rateUnemployment)
        : 0;
      const socialInsurance = pension + medical + unemployment;
      const housingFund = hfRule ? hfBase * Number(hfRule.rateEmployee) : 0;

      const special = configSpecial + userSpecialMonthly;
      const taxable = Math.max(
        0,
        gross +
          bonus +
          ltcIncome +
          equityIncome -
          socialInsurance -
          housingFund -
          standard -
          special,
      );

      monthlyTaxables[m - 1] = taxable;
      monthRecords[m - 1] = {
        monthDate,
        gross,
        bonus,
        ltcIncome,
        equityIncome,
        socialInsurance,
        housingFund,
        standard,
        special,
        cityId: monthCityId,
      };
    }

    const taxRes = await calculateTax({
      country: representativeCity.country,
      taxYear,
      monthlyTaxables,
    });

    let cumulativeTaxable = 0;
    for (let i = 0; i < endMonth; i++) {
      cumulativeTaxable += Math.max(0, monthlyTaxables[i] || 0);
      monthlyCumTaxables[i] = cumulativeTaxable;
    }

    for (let m = startMonth; m <= endMonth; m++) {
      const record = monthRecords[m - 1];
      if (!record) continue;
      const tax = taxRes[m - 1];
      const net =
        record.gross +
        record.bonus +
        record.ltcIncome +
        record.equityIncome -
        record.socialInsurance -
        record.housingFund -
        tax.monthTax;

      await prisma.incomeRecord.upsert({
        where: {
          userId_monthDate: {
            userId: user.id,
            monthDate: record.monthDate,
          },
        },
        update: {
          cityId: record.cityId,
          currency: user.baseCurrency,
          gross: record.gross,
          bonus: record.bonus,
          ltcIncome: record.ltcIncome,
          equityIncome: record.equityIncome,
          socialInsurance: record.socialInsurance,
          housingFund: record.housingFund,
          specialDeductions: record.special,
          taxableCurrent: monthlyTaxables[m - 1],
          incomeTax: tax.monthTax,
          taxPaidCumulative: tax.cumulativePaid,
          taxableCumulative: monthlyCumTaxables[m - 1],
          taxCumulative: tax.cumulativeTax,
          netIncome: net,
          source: "system",
          isForecast: false,
        },
        create: {
          userId: user.id,
          monthDate: record.monthDate,
          cityId: record.cityId,
          currency: user.baseCurrency,
          gross: record.gross,
          bonus: record.bonus,
          ltcIncome: record.ltcIncome,
          equityIncome: record.equityIncome,
          socialInsurance: record.socialInsurance,
          housingFund: record.housingFund,
          specialDeductions: record.special,
          taxableCurrent: monthlyTaxables[m - 1],
          incomeTax: tax.monthTax,
          taxPaidCumulative: tax.cumulativePaid,
          taxableCumulative: monthlyCumTaxables[m - 1],
          taxCumulative: tax.cumulativeTax,
          netIncome: net,
          source: "system",
          isForecast: false,
        },
      });
      updated++;
    }
  }

  return { updated } as const;
}

const toUtcMonth = (date: Date) => date.getUTCMonth() + 1;

export async function ensureIncomeRecordsForUser(userId: string) {
  const incomeChangeRepo = (prisma as any).incomeChange;
  const bonusRepo = (prisma as any).bonusPlan;
  const ltcRepo = (prisma as any).longTermCashPayout;
  const vestRepo = (prisma as any).equityVest;
  const recordRepo = (prisma as any).incomeRecord;

  if (
    !recordRepo ||
    typeof recordRepo.findFirst !== "function" ||
    !incomeChangeRepo ||
    typeof incomeChangeRepo.findFirst !== "function"
  ) {
    return;
  }

  const [
    firstIncomeChangeRaw,
    bonusEarliestRaw,
    ltcEarliestRaw,
    vestEarliestRaw,
    firstRecord,
  ] = await Promise.all([
    incomeChangeRepo.findFirst({
      where: { userId },
      orderBy: { effectiveFrom: "asc" },
    }),
    bonusRepo && typeof bonusRepo.findMany === "function"
      ? bonusRepo.findMany({
          where: { userId },
          orderBy: { effectiveDate: "asc" },
          take: 1,
        })
      : [],
    ltcRepo && typeof ltcRepo.findMany === "function"
      ? ltcRepo.findMany({
          where: { plan: { userId } },
          orderBy: { payDate: "asc" },
          take: 1,
        })
      : [],
    vestRepo && typeof vestRepo.findMany === "function"
      ? vestRepo.findMany({
          where: { grant: { userId } },
          orderBy: { vestDate: "asc" },
          take: 1,
        })
      : [],
    recordRepo.findFirst({
      where: { userId },
      orderBy: { monthDate: "asc" },
    }),
  ]);

  const firstIncomeChange = firstIncomeChangeRaw ?? null;
  const bonusEarliest = Array.isArray(bonusEarliestRaw) ? bonusEarliestRaw : [];
  const ltcEarliest = Array.isArray(ltcEarliestRaw) ? ltcEarliestRaw : [];
  const vestEarliest = Array.isArray(vestEarliestRaw) ? vestEarliestRaw : [];

  const candidates = [
    firstIncomeChange?.effectiveFrom,
    bonusEarliest?.[0]?.effectiveDate,
    ltcEarliest?.[0]?.payDate,
    vestEarliest?.[0]?.vestDate,
    firstRecord?.monthDate,
  ].filter((d): d is Date => !!d);

  if (candidates.length === 0) return;

  const earliestDate = candidates.reduce((min, current) =>
    current < min ? current : min,
  );
  const earliestYear = earliestDate.getUTCFullYear();
  const earliestMonth = toUtcMonth(earliestDate);

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = toUtcMonth(now);

  for (let year = earliestYear; year <= currentYear; year++) {
    const startMonth = year === earliestYear ? earliestMonth : 1;
    const endMonth = year === currentYear ? currentMonth : 12;
    if (endMonth < startMonth) continue;

    const records = await recordRepo.findMany({
      where: {
        userId,
        monthDate: {
          gte: new Date(Date.UTC(year, 0, 1, 0, 0, 0)),
          lt: new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0)),
        },
      },
      select: { monthDate: true },
    });
    const existingMonths = new Set(records.map((r) => toUtcMonth(r.monthDate)));

    let missing = false;
    for (let m = startMonth; m <= endMonth; m++) {
      if (!existingMonths.has(m)) {
        missing = true;
        break;
      }
    }
    if (missing) {
      await recalcIncome({
        userId,
        taxYear: year,
        startMonth,
        endMonth,
      });
    }
  }
}

export type IncomeRecordsSummary = {
  months: number;
  currency: string | null;
  totalGross: number;
  totalBonus: number;
  totalLtc: number;
  totalEquity: number;
  totalSocialInsurance: number;
  totalHousingFund: number;
  totalSpecialDeductions: number;
  totalTax: number;
  totalNet: number;
  totalIncome: number;
  avgTaxRate: number;
  latestTaxPaid?: number;
  latestTaxCumulative?: number;
};

export function summarizeIncomeRecords(
  records: IncomeRecord[],
): IncomeRecordsSummary {
  if (records.length === 0) {
    return {
      months: 0,
      currency: null,
      totalGross: 0,
      totalBonus: 0,
      totalLtc: 0,
      totalEquity: 0,
      totalSocialInsurance: 0,
      totalHousingFund: 0,
      totalSpecialDeductions: 0,
      totalTax: 0,
      totalNet: 0,
      totalIncome: 0,
      avgTaxRate: 0,
      latestTaxPaid: 0,
      latestTaxCumulative: 0,
    };
  }

  const totals = records.reduce(
    (acc, record) => {
      acc.totalGross += Number(record.gross || 0);
      acc.totalBonus += Number(record.bonus || 0);
      acc.totalLtc += Number(record.ltcIncome || 0);
      acc.totalEquity += Number(record.equityIncome || 0);
      acc.totalSocialInsurance += Number(record.socialInsurance || 0);
      acc.totalHousingFund += Number(record.housingFund || 0);
      acc.totalSpecialDeductions += Number(record.specialDeductions || 0);
      acc.totalTax += Number(record.incomeTax || 0);
      acc.totalNet += Number(record.netIncome || 0);
      return acc;
    },
    {
      totalGross: 0,
      totalBonus: 0,
      totalLtc: 0,
      totalEquity: 0,
      totalSocialInsurance: 0,
      totalHousingFund: 0,
      totalSpecialDeductions: 0,
      totalTax: 0,
      totalNet: 0,
    },
  );

  const totalIncome =
    totals.totalGross +
    totals.totalBonus +
    totals.totalLtc +
    totals.totalEquity;
  const avgTaxRate =
    totalIncome > 0 ? Number((totals.totalTax / totalIncome) * 100) : 0;

  const latest = records[records.length - 1];

  return {
    months: records.length,
    currency: records[0]?.currency ?? null,
    totalIncome,
    avgTaxRate,
    latestTaxPaid: Number(latest?.taxPaidCumulative || 0),
    latestTaxCumulative: Number(latest?.taxCumulative || 0),
    ...totals,
  };
}
