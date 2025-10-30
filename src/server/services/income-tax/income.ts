import type { IncomeRecord } from "@prisma/client";
import prisma from "@/server/db";
import { logAudit } from "@/server/services/audit";
import { writeOutboxEvent } from "@/server/services/outbox";
import {
  enqueueIncomeRecalcTask as enqueueIncomeRecalcJob,
  fetchPendingIncomeRecalcTasks,
  markIncomeRecalcCompleted,
  markIncomeRecalcFailed,
  markIncomeRecalcRunning,
  releaseIncomeRecalcTasks,
} from "@/server/services/jobs/queue";
import {
  computeCumulativeTax,
  getTaxContext,
  type TaxContext,
  type TaxComputationInput,
} from "./tax";
import {
  convert,
  type FxSnapshotInfo,
} from "@/server/services/fx";

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

const normalizeCurrency = (value?: string | null) => {
  if (!value) return "CNY";
  return value.trim().toUpperCase() || "CNY";
};

const monthCacheKey = (date: Date) =>
  monthStartUTC(date).toISOString().slice(0, 10);

type ConversionCacheValue = {
  rate: number;
  snapshot: FxSnapshotInfo | null;
};

async function ensureConversionRate(
  cache: Map<string, ConversionCacheValue>,
  from: string,
  to: string,
  asOf: Date,
): Promise<ConversionCacheValue> {
  const normalizedFrom = normalizeCurrency(from);
  const normalizedTo = normalizeCurrency(to);
  if (normalizedFrom === normalizedTo) return { rate: 1, snapshot: null };
  const key = `${normalizedFrom}->${normalizedTo}::${monthCacheKey(asOf)}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const result = await convert(1, normalizedFrom, normalizedTo, asOf);
  const snapshot =
    result.snapshots.find(
      (item) => normalizeCurrency(item.quoteCurrency) === normalizedTo,
    ) ?? result.snapshots[0] ?? null;
  const value: ConversionCacheValue = {
    rate:
      typeof result.effectiveRate === "number" && Number.isFinite(result.effectiveRate)
        ? result.effectiveRate
        : result.amount,
    snapshot,
  };
  cache.set(key, value);
  return value;
}

async function convertAmountValue(
  cache: Map<string, ConversionCacheValue>,
  amount: number,
  from: string,
  to: string,
  asOf: Date,
) {
  const normalizedFrom = normalizeCurrency(from);
  const normalizedTo = normalizeCurrency(to);
  if (normalizedFrom === normalizedTo) {
    return { amount, rate: 1, snapshot: null };
  }
  if (!Number.isFinite(amount) || amount === 0) {
    const info = await ensureConversionRate(cache, normalizedFrom, normalizedTo, asOf);
    return { amount: amount * info.rate, rate: info.rate, snapshot: info.snapshot };
  }
  const info = await ensureConversionRate(cache, normalizedFrom, normalizedTo, asOf);
  return { amount: amount * info.rate, rate: info.rate, snapshot: info.snapshot };
}

type MonthComputation = {
  monthDate: Date;
  cityId: string;
  taxContext: TaxContext;
  currency: string;
  sourceCurrency: string;
  fxSnapshotId: string | null;
  fxAppliedRate: number;
  gross: number;
  bonus: number;
  ltcIncome: number;
  equityIncome: number;
  socialInsurance: number;
  socialInsuranceBase?: number;
  housingFund: number;
  housingFundBase?: number;
  standard: number;
  special: number;
  taxableCurrent: number;
  incomeTax: number;
  taxPaidCumulative: number;
  taxableCumulative: number;
  taxCumulative: number;
  netIncome: number;
};

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
  const task = await enqueueIncomeRecalcJob({
    userId,
    taxYear,
    startMonth,
    endMonth,
    cityId,
    triggeredBy,
    delayMs,
  });
  const scheduledFor = task.scheduledFor ?? new Date();
  await logAudit("INCOME_RECALC_TASK_SCHEDULED", {
    userId: userId ?? null,
    meta: {
      taskId: task.id,
      taxYear,
      startMonth: task.startMonth,
      endMonth: task.endMonth,
      scheduledFor: scheduledFor.toISOString(),
    },
  });

  return task.id;
}

export async function listIncomeRecalcTasks(userId: string) {
  return prisma.incomeRecalcTask.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }],
    take: 50,
  });
}

export async function processDueIncomeRecalcTasks(limit = 5) {
  const due = await fetchPendingIncomeRecalcTasks(limit);
  const results: ProcessResult[] = [];
  for (const task of due) {
    const claimSucceeded = await markIncomeRecalcRunning(task);
    if (!claimSucceeded) continue;
    try {
      const res = await recalcIncome({
        taxYear: task.taxYear,
        startMonth: task.startMonth,
        endMonth: task.endMonth,
        userId: task.userId ?? undefined,
        cityId: task.cityId ?? undefined,
      });
      await markIncomeRecalcCompleted(task, res.updated);
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
      const retryAt = new Date(Date.now() + RECLAC_RETRY_DELAY_MS);
      await markIncomeRecalcFailed(task, message, retryAt);
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
  await releaseIncomeRecalcTasks(prisma, userId, taxYear);
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
    const conversionCache = new Map<string, ConversionCacheValue>();
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

    const taxInputs: Array<TaxComputationInput | null> = new Array(12).fill(
      null,
    );
    const monthComputations: Array<MonthComputation | null> = new Array(12).fill(
      null,
    );

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
      const recordsMap = new Map<number, IncomeRecord>();
      previousRecords.forEach((record) => {
        recordsMap.set(record.monthDate.getUTCMonth(), record);
      });
      for (let m = 1; m < startMonth; m++) {
        const monthIdx = m - 1;
        const monthDate = new Date(Date.UTC(taxYear, monthIdx, 1, 0, 0, 0));
        const existingRecord = recordsMap.get(monthIdx) ?? null;
        const resolvedCityId =
          existingRecord?.cityId ?? resolveCity(monthDate);
        const cityMeta =
          resolvedCityId && cityMap.has(resolvedCityId)
            ? cityMap.get(resolvedCityId)!
            : representativeCity;
        if (!cityMeta) continue;
        const context = await getTaxContext(cityMeta.country, monthDate);
        const taxable = existingRecord
          ? Number(existingRecord.taxableCurrent || 0)
          : 0;
        taxInputs[monthIdx] = { taxable, context };
      }
    }

    for (let m = startMonth; m <= endMonth; m++) {
      const monthDate = new Date(Date.UTC(taxYear, m - 1, 1, 0, 0, 0));
      const nextMonthStart = new Date(Date.UTC(taxYear, m, 1, 0, 0, 0));
      const monthCityId = resolveCity(monthDate);

      const cityMeta =
        monthCityId && cityMap.has(monthCityId)
          ? cityMap.get(monthCityId)!
          : representativeCity;
      if (!cityMeta) continue;

      const taxContext = await getTaxContext(cityMeta.country, monthDate);
      const targetCurrency = taxContext.currency;

      const incomeChange = await prisma.incomeChange.findFirst({
        where: { userId: user.id, effectiveFrom: { lt: nextMonthStart } },
        orderBy: { effectiveFrom: "desc" },
      });
      const grossOriginal = Number(incomeChange?.grossMonthly || 0);
      const grossCurrency = normalizeCurrency(incomeChange?.currency);
      const monthRecord: MonthComputation = {
        monthDate,
        cityId: monthCityId,
        taxContext,
        currency: targetCurrency,
        sourceCurrency: targetCurrency,
        fxSnapshotId: null,
        fxAppliedRate: 1,
        gross: 0,
        bonus: 0,
        ltcIncome: 0,
        equityIncome: 0,
        socialInsurance: 0,
        socialInsuranceBase: 0,
        housingFund: 0,
        housingFundBase: 0,
        standard: taxContext.standard,
        special: 0,
        taxableCurrent: 0,
        incomeTax: 0,
        taxPaidCumulative: 0,
        taxableCumulative: 0,
        taxCumulative: 0,
        netIncome: 0,
      };

      const conversionCandidates: Array<{ currency: string; amount: number }> =
        [];
      let grossConversion: ConversionCacheValue | null = null;
      if (grossOriginal !== 0) {
        conversionCandidates.push({
          currency: grossCurrency,
          amount: Math.abs(grossOriginal),
        });
        if (normalizeCurrency(grossCurrency) === targetCurrency) {
          monthRecord.gross = grossOriginal;
          grossConversion = { rate: 1, snapshot: null };
        } else {
          const converted = await convertAmountValue(
            conversionCache,
            grossOriginal,
            grossCurrency,
            targetCurrency,
            monthDate,
          );
          monthRecord.gross = converted.amount;
          grossConversion = {
            rate: converted.rate,
            snapshot: converted.snapshot,
          };
        }
      }

      const bonusRows = await prisma.bonusPlan.findMany({
        where: {
          userId: user.id,
          effectiveDate: { gte: monthDate, lt: nextMonthStart },
        },
      });
      let bonusTotal = 0;
      for (const item of bonusRows) {
        const amount = Number(item.amount || 0);
        if (!amount) continue;
        const itemCurrency = normalizeCurrency(item.currency);
        const converted = await convertAmountValue(
          conversionCache,
          amount,
          itemCurrency,
          targetCurrency,
          monthDate,
        );
        bonusTotal += converted.amount;
        conversionCandidates.push({
          currency: itemCurrency,
          amount: Math.abs(amount),
        });
      }
      monthRecord.bonus = bonusTotal;

      const ltcRows = await prisma.longTermCashPayout.findMany({
        where: {
          plan: { userId: user.id },
          payDate: { gte: monthDate, lt: nextMonthStart },
        },
      });
      let ltcIncome = 0;
      for (const payout of ltcRows) {
        const amount = Number(payout.amount || 0);
        if (!amount) continue;
        const payoutCurrency = normalizeCurrency(payout.currency);
        const converted = await convertAmountValue(
          conversionCache,
          amount,
          payoutCurrency,
          targetCurrency,
          monthDate,
        );
        ltcIncome += converted.amount;
        conversionCandidates.push({
          currency: payoutCurrency,
          amount: Math.abs(amount),
        });
      }
      monthRecord.ltcIncome = ltcIncome;

      const equityRows = await prisma.equityVest.findMany({
        where: {
          grant: { userId: user.id },
          vestDate: { gte: monthDate, lt: nextMonthStart },
          fairValue: { not: null },
        },
      });
      let equityIncome = 0;
      for (const vest of equityRows) {
        const amount = Number(vest.fairValue || 0);
        if (!amount) continue;
        const vestCurrency = normalizeCurrency(vest.currency);
        const converted = await convertAmountValue(
          conversionCache,
          amount,
          vestCurrency,
          targetCurrency,
          monthDate,
        );
        equityIncome += converted.amount;
        conversionCandidates.push({
          currency: vestCurrency,
          amount: Math.abs(amount),
        });
      }
      monthRecord.equityIncome = equityIncome;

      const ssRule = await prisma.cityRuleSS.findFirst({
        where: {
          cityId: monthCityId,
          effectiveFrom: { lte: monthDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: monthDate } }],
        },
        orderBy: { effectiveFrom: "desc" },
      });
      if (ssRule) {
        const ssCurrency = normalizeCurrency(ssRule.currency);
        const grossForSS =
          grossOriginal > 0
            ? ssCurrency === normalizeCurrency(grossCurrency)
              ? grossOriginal
              : (
                  await convertAmountValue(
                    conversionCache,
                    grossOriginal,
                    grossCurrency,
                    ssCurrency,
                    monthDate,
                  )
                ).amount
            : 0;
        const ssBaseRaw =
          grossForSS > 0
            ? clamp(grossForSS, Number(ssRule.baseMin), Number(ssRule.baseMax))
            : 0;
        let socialInsuranceRaw = 0;
        if (ssBaseRaw > 0) {
          const pension = ssBaseRaw * Number(ssRule.ratePension);
          const medical =
            ssBaseRaw * Number(ssRule.rateMedical) +
            Number(ssRule.fixedMedicalPersonal || 0);
          const unemployment = ssBaseRaw * Number(ssRule.rateUnemployment);
          socialInsuranceRaw = pension + medical + unemployment;
        }
        let socialInsurance = 0;
        if (socialInsuranceRaw !== 0) {
          socialInsurance =
            ssCurrency === targetCurrency
              ? socialInsuranceRaw
              : (
                  await convertAmountValue(
                    conversionCache,
                    socialInsuranceRaw,
                    ssCurrency,
                    targetCurrency,
                    monthDate,
                  )
                ).amount;
        }
        let socialBaseTarget = 0;
        if (ssBaseRaw > 0) {
          socialBaseTarget =
            ssCurrency === targetCurrency
              ? ssBaseRaw
              : (
                  await convertAmountValue(
                    conversionCache,
                    ssBaseRaw,
                    ssCurrency,
                    targetCurrency,
                    monthDate,
                  )
                ).amount;
        }
        monthRecord.socialInsurance = socialInsurance;
        monthRecord.socialInsuranceBase = socialBaseTarget;
      }

      const hfRule = await prisma.cityRuleHF.findFirst({
        where: {
          cityId: monthCityId,
          effectiveFrom: { lte: monthDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: monthDate } }],
        },
        orderBy: { effectiveFrom: "desc" },
      });
      if (hfRule) {
        const hfCurrency = normalizeCurrency(hfRule.currency);
        const grossForHF =
          grossOriginal > 0
            ? hfCurrency === normalizeCurrency(grossCurrency)
              ? grossOriginal
              : (
                  await convertAmountValue(
                    conversionCache,
                    grossOriginal,
                    grossCurrency,
                    hfCurrency,
                    monthDate,
                  )
                ).amount
            : 0;
        const hfBaseRaw =
          grossForHF > 0
            ? clamp(grossForHF, Number(hfRule.baseMin), Number(hfRule.baseMax))
            : 0;
        let housingRaw = 0;
        if (hfBaseRaw > 0) {
          housingRaw = hfBaseRaw * Number(hfRule.rateEmployee);
        }
        let housingFund = 0;
        if (housingRaw !== 0) {
          housingFund =
            hfCurrency === targetCurrency
              ? housingRaw
              : (
                  await convertAmountValue(
                    conversionCache,
                    housingRaw,
                    hfCurrency,
                    targetCurrency,
                    monthDate,
                  )
                ).amount;
        }
        let housingBaseTarget = 0;
        if (hfBaseRaw > 0) {
          housingBaseTarget =
            hfCurrency === targetCurrency
              ? hfBaseRaw
              : (
                  await convertAmountValue(
                    conversionCache,
                    hfBaseRaw,
                    hfCurrency,
                    targetCurrency,
                    monthDate,
                  )
                ).amount;
        }
        monthRecord.housingFund = housingFund;
        monthRecord.housingFundBase = housingBaseTarget;
      }

      const special = taxContext.special + userSpecialMonthly;
      monthRecord.special = special;

      const taxable =
        monthRecord.gross +
        monthRecord.bonus +
        monthRecord.ltcIncome +
        monthRecord.equityIncome -
        monthRecord.socialInsurance -
        monthRecord.housingFund -
        taxContext.standard -
        special;
      monthRecord.taxableCurrent = Math.max(0, taxable);

      let sourceCurrency = targetCurrency;
      if (grossOriginal > 0) {
        sourceCurrency = normalizeCurrency(grossCurrency);
      } else {
        const candidate = conversionCandidates.find((item) => item.amount > 0);
        if (candidate) sourceCurrency = normalizeCurrency(candidate.currency);
      }
      monthRecord.sourceCurrency = sourceCurrency;

      if (sourceCurrency === targetCurrency) {
        monthRecord.fxAppliedRate = 1;
        monthRecord.fxSnapshotId = null;
      } else if (
        grossConversion &&
        normalizeCurrency(grossCurrency) === sourceCurrency
      ) {
        monthRecord.fxAppliedRate = grossConversion.rate;
        monthRecord.fxSnapshotId = grossConversion.snapshot?.id ?? null;
      } else {
        const fxInfo = await ensureConversionRate(
          conversionCache,
          sourceCurrency,
          targetCurrency,
          monthDate,
        );
        monthRecord.fxAppliedRate = fxInfo.rate;
        monthRecord.fxSnapshotId = fxInfo.snapshot?.id ?? null;
      }

      monthComputations[m - 1] = monthRecord;
      taxInputs[m - 1] = {
        taxable: monthRecord.taxableCurrent,
        context: taxContext,
      };
    }

    const taxRes = computeCumulativeTax(taxInputs);
    for (let m = startMonth; m <= endMonth; m++) {
      const record = monthComputations[m - 1];
      if (!record) continue;
      const tax = taxRes[m - 1];
      const monthTax = tax?.monthTax ?? 0;
      const cumulativePaid = tax?.cumulativePaid ?? monthTax;
      const cumulativeTaxable = tax?.cumulativeTaxable ?? record.taxableCurrent;
      const cumulativeTax = tax?.cumulativeTax ?? monthTax;
      record.incomeTax = monthTax;
      record.taxPaidCumulative = cumulativePaid;
      record.taxableCumulative = cumulativeTaxable;
      record.taxCumulative = cumulativeTax;
      record.netIncome =
        record.gross +
        record.bonus +
        record.ltcIncome +
        record.equityIncome -
        record.socialInsurance -
        record.housingFund -
        monthTax;

      await prisma.$transaction(async (tx) => {
        const saved = await tx.incomeRecord.upsert({
          where: {
            userId_monthDate: {
              userId: user.id,
              monthDate: record.monthDate,
            },
          },
          update: {
            cityId: record.cityId,
            currency: record.currency,
            sourceCurrency: record.sourceCurrency,
            fxRateId: null,
            fxSnapshotId: record.fxSnapshotId,
            fxAppliedRate: record.fxAppliedRate,
            gross: record.gross,
            bonus: record.bonus,
            ltcIncome: record.ltcIncome,
            equityIncome: record.equityIncome,
            socialInsurance: record.socialInsurance,
            socialInsuranceBase: record.socialInsuranceBase ?? 0,
            housingFund: record.housingFund,
            housingFundBase: record.housingFundBase ?? 0,
            specialDeductions: record.special,
            taxableCurrent: record.taxableCurrent,
            incomeTax: monthTax,
            taxPaidCumulative: cumulativePaid,
            taxableCumulative: cumulativeTaxable,
            taxCumulative: cumulativeTax,
            netIncome: record.netIncome,
            source: "system",
            isForecast: false,
          },
          create: {
            userId: user.id,
            monthDate: record.monthDate,
            cityId: record.cityId,
            currency: record.currency,
            sourceCurrency: record.sourceCurrency,
            fxRateId: null,
            fxSnapshotId: record.fxSnapshotId,
            fxAppliedRate: record.fxAppliedRate,
            gross: record.gross,
            bonus: record.bonus,
            ltcIncome: record.ltcIncome,
            equityIncome: record.equityIncome,
            socialInsurance: record.socialInsurance,
            socialInsuranceBase: record.socialInsuranceBase ?? 0,
            housingFund: record.housingFund,
            housingFundBase: record.housingFundBase ?? 0,
            specialDeductions: record.special,
            taxableCurrent: record.taxableCurrent,
            incomeTax: monthTax,
            taxPaidCumulative: cumulativePaid,
            taxableCumulative: cumulativeTaxable,
            taxCumulative: cumulativeTax,
            netIncome: record.netIncome,
            source: "system",
            isForecast: false,
          },
        });
        await writeOutboxEvent(tx, {
          eventType: "income.record.updated",
          payload: {
            recordId: saved.id,
            userId: user.id,
            monthDate: record.monthDate.toISOString(),
            taxYear,
            month: m,
            gross: record.gross,
            bonus: record.bonus,
            ltcIncome: record.ltcIncome,
            equityIncome: record.equityIncome,
            socialInsurance: record.socialInsurance,
            housingFund: record.housingFund,
            taxableCurrent: record.taxableCurrent,
            taxPaidCumulative: cumulativePaid,
            taxableCumulative: cumulativeTaxable,
            taxCumulative: cumulativeTax,
            netIncome: record.netIncome,
            cityId: record.cityId,
            fxSnapshotId: record.fxSnapshotId,
            fxAppliedRate: record.fxAppliedRate,
          },
        });
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
