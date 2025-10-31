import type {
  BonusPlan,
  CityChangeRecord,
  IncomeChange,
  IncomeRecord,
  LongTermCashPayout,
} from "@prisma/client";
import prisma from "@/server/db";
import { ensureIncomeRecordsForUser } from "./income";
import {
  computeCumulativeTax,
  getTaxContext,
  type TaxComputationInput,
  type TaxContext,
} from "./tax";
import { convert } from "@/server/services/fx/provider";

type TimelineSource = "system" | "manual" | "forecast";

export type TimelineItem = {
  recordId: string | null;
  monthDate: string;
  month: string;
  currency: string;
  recordCurrency: string;
  sourceCurrency: string | null;
  cityId: string | null;
  gross: number;
  bonus: number;
  ltcIncome: number;
  equityIncome: number;
  socialInsurance: number;
  housingFund: number;
  specialDeductions: number;
  taxableCurrent: number;
  taxableCumulative: number;
  taxCumulative: number;
  taxPaidCumulative: number;
  incomeTax: number;
  netIncome: number;
  source: TimelineSource;
  isForecast: boolean;
  manualNet: number | null;
  manualNote: string | null;
  fxSnapshotId: string | null;
  fxSnapshotCapturedAt: string | null;
  fxAppliedRate: number;
  displayCurrency: string;
  displayRate: number;
};

type TimelineTotals = {
  gross: number;
  bonus: number;
  ltcIncome: number;
  equityIncome: number;
  socialInsurance: number;
  housingFund: number;
  incomeTax: number;
  netIncome: number;
};

export type TimelineSummary = {
  currency: string;
  counts: {
    total: number;
    actual: number;
    forecast: number;
  };
  totals: {
    actual: TimelineTotals;
    forecast: TimelineTotals;
    combined: TimelineTotals;
  };
};

export type IncomeTimelineResponse = {
  items: TimelineItem[];
  summary: TimelineSummary;
  meta: {
    range: {
      from: string;
      to: string;
    };
  };
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const toNumber = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  if (typeof value === "object" && value !== null && "toString" in value) {
    const str = (value as { toString: () => string }).toString();
    return Number(str) || 0;
  }
  return Number(value) || 0;
};

const monthKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

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
};

async function ensureConversionRate(
  cache: Map<string, ConversionCacheValue>,
  from: string,
  to: string,
  asOf: Date,
): Promise<ConversionCacheValue> {
  const normalizedFrom = normalizeCurrency(from);
  const normalizedTo = normalizeCurrency(to);
  if (normalizedFrom === normalizedTo) return { rate: 1 };
  const key = `${normalizedFrom}->${normalizedTo}::${monthCacheKey(asOf)}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const result = await convert(1, normalizedFrom, normalizedTo, asOf);
  const value: ConversionCacheValue = {
    rate:
      typeof result.effectiveRate === "number" && Number.isFinite(result.effectiveRate)
        ? result.effectiveRate
        : result.amount,
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
    return { amount, rate: 1 };
  }
  if (!Number.isFinite(amount) || amount === 0) {
    const info = await ensureConversionRate(cache, normalizedFrom, normalizedTo, asOf);
    return { amount: amount * info.rate, rate: info.rate };
  }
  const info = await ensureConversionRate(cache, normalizedFrom, normalizedTo, asOf);
  return { amount: amount * info.rate, rate: info.rate };
}

async function convertTimelineItemCurrency(
  item: TimelineItem,
  targetCurrency: string,
  cache: Map<string, ConversionCacheValue>,
) {
  const currentDisplay = normalizeCurrency(item.displayCurrency);
  if (currentDisplay === targetCurrency) {
    return { ...item, currency: targetCurrency };
  }
  const { rate } = await ensureConversionRate(
    cache,
    currentDisplay,
    targetCurrency,
    new Date(item.monthDate),
  );
  const apply = (value: number) =>
    Number.isFinite(value) ? value * rate : value;
  return {
    ...item,
    currency: targetCurrency,
    displayCurrency: targetCurrency,
    displayRate: item.displayRate * rate,
    gross: apply(item.gross),
    bonus: apply(item.bonus),
    ltcIncome: apply(item.ltcIncome),
    equityIncome: apply(item.equityIncome),
    socialInsurance: apply(item.socialInsurance),
    housingFund: apply(item.housingFund),
    specialDeductions: apply(item.specialDeductions),
    taxableCurrent: apply(item.taxableCurrent),
    taxableCumulative: apply(item.taxableCumulative),
    taxCumulative: apply(item.taxCumulative),
    taxPaidCumulative: apply(item.taxPaidCumulative),
    incomeTax: apply(item.incomeTax),
    netIncome: apply(item.netIncome),
    manualNet:
      item.manualNet !== null && item.manualNet !== undefined
        ? apply(item.manualNet)
        : item.manualNet,
  };
}

const addMonths = (date: Date, count: number) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1));

const enumerateMonths = (start: Date, end: Date) => {
  const months: Date[] = [];
  const current = monthStartUTC(start);
  const final = monthStartUTC(end);
  while (current <= final) {
    months.push(new Date(current));
    current.setUTCMonth(current.getUTCMonth() + 1);
  }
  return months;
};

const isWithinMonth = (value: Date, start: Date, next: Date) =>
  value >= start && value < next;

type CityMeta = { id: string; country: string };

function buildCityResolver(
  fallbackCityId: string,
  changes: CityChangeRecord[],
) {
  const sorted = [...changes].sort(
    (a, b) =>
      new Date(a.effectiveMonth).getTime() -
      new Date(b.effectiveMonth).getTime(),
  );
  return (monthDate: Date) => {
    let currentCity = fallbackCityId;
    const monthStart = monthStartUTC(monthDate).getTime();
    for (const change of sorted) {
      const effectiveStart = monthStartUTC(change.effectiveMonth).getTime();
      if (monthStart >= effectiveStart) {
        currentCity = change.toCityId ?? currentCity;
      } else {
        break;
      }
    }
    return currentCity;
  };
}

const zeroTotals = (): TimelineTotals => ({
  gross: 0,
  bonus: 0,
  ltcIncome: 0,
  equityIncome: 0,
  socialInsurance: 0,
  housingFund: 0,
  incomeTax: 0,
  netIncome: 0,
});

type ForecastMeta = {
  monthDate: Date;
  cityId: string;
  currency: string;
  gross: number;
  bonus: number;
  ltcIncome: number;
  equityIncome: number;
  socialInsurance: number;
  housingFund: number;
  specialDeductions: number;
  taxableCurrent: number;
  taxContext: TaxContext;
};

function toTimelineItem(record: IncomeRecord): TimelineItem {
  const recordCurrency = record.currency || "CNY";
  const sourceCurrency =
    record.sourceCurrency && record.sourceCurrency.length > 0
      ? record.sourceCurrency
      : recordCurrency;
  const manualNet =
    record.manualNet !== null && record.manualNet !== undefined
      ? toNumber(record.manualNet)
      : null;
  const displayNet =
    manualNet !== null ? manualNet : toNumber(record.netIncome);
  const fxAppliedRate =
    record.fxAppliedRate !== null && record.fxAppliedRate !== undefined
      ? toNumber(record.fxAppliedRate)
      : 1;
  const fxSnapshotCapturedAt =
    (record as any).fxSnapshot?.capturedAt instanceof Date
      ? (record as any).fxSnapshot.capturedAt.toISOString()
      : null;
  return {
    recordId: record.id,
    monthDate: record.monthDate.toISOString(),
    month: monthKey(record.monthDate),
    currency: recordCurrency,
    recordCurrency,
    sourceCurrency,
    cityId: record.cityId,
    gross: toNumber(record.gross),
    bonus: toNumber(record.bonus),
    ltcIncome: toNumber(record.ltcIncome),
    equityIncome: toNumber(record.equityIncome),
    socialInsurance: toNumber(record.socialInsurance),
    housingFund: toNumber(record.housingFund),
    specialDeductions: toNumber(record.specialDeductions),
    taxableCurrent: toNumber(record.taxableCurrent),
    taxableCumulative: toNumber(record.taxableCumulative),
    taxCumulative: toNumber(record.taxCumulative),
    taxPaidCumulative: toNumber(record.taxPaidCumulative),
    incomeTax: toNumber(
      record.manualIncomeTax !== null && record.manualIncomeTax !== undefined
        ? record.manualIncomeTax
        : record.incomeTax,
    ),
    netIncome: displayNet,
    source: (record.source as TimelineSource) ?? "system",
    isForecast: Boolean(record.isForecast),
    manualNet,
    manualNote: record.manualNote ?? null,
    fxSnapshotId: record.fxSnapshotId ?? null,
    fxSnapshotCapturedAt,
    fxAppliedRate,
    displayCurrency: recordCurrency,
    displayRate: 1,
  };
}

function getSalaryForMonth(
  monthDate: Date,
  nextMonth: Date,
  salaryChanges: IncomeChange[],
): { amount: number; currency: string } {
  let latest: IncomeChange | null = null;
  for (const change of salaryChanges) {
    const effective = new Date(change.effectiveFrom);
    if (effective < nextMonth) {
      if (!latest || effective > new Date(latest.effectiveFrom)) {
        latest = change;
      }
    } else {
      break;
    }
  }
  if (!latest) {
    return { amount: 0, currency: "CNY" };
  }
  return {
    amount: toNumber(latest.grossMonthly),
    currency: normalizeCurrency(latest.currency),
  };
}

async function computeForecastMeta(
  monthDate: Date,
  salaryChanges: IncomeChange[],
  bonusPlans: BonusPlan[],
  ltcPayouts: LongTermCashPayout[],
  equityVests: EquityVest[],
  resolveCity: (monthDate: Date) => string,
  cityMetaMap: Map<string, CityMeta>,
  annualDeductionMap: Map<number, number>,
  conversionCache: Map<string, ConversionCacheValue>,
): Promise<ForecastMeta> {
  const nextMonth = addMonths(monthDate, 1);
  const cityId = resolveCity(monthDate);
  const cityMeta = cityMetaMap.get(cityId);
  const country = cityMeta?.country ?? "CN";
  const taxContext = await getTaxContext(country, monthDate);
  const targetCurrency = taxContext.currency;

  const salaryInfo = getSalaryForMonth(monthDate, nextMonth, salaryChanges);
  const salaryConverted =
    salaryInfo.amount !== 0
      ? await convertAmountValue(
          conversionCache,
          salaryInfo.amount,
          salaryInfo.currency,
          targetCurrency,
          monthDate,
        )
      : { amount: 0, rate: 1 };
  const salary = salaryConverted.amount;

  let bonus = 0;
  for (const plan of bonusPlans) {
    const effective = new Date(plan.effectiveDate);
    if (!isWithinMonth(effective, monthDate, nextMonth)) continue;
    const converted = await convertAmountValue(
      conversionCache,
      toNumber(plan.amount),
      plan.currency,
      targetCurrency,
      monthDate,
    );
    bonus += converted.amount;
  }

  let ltc = 0;
  for (const payout of ltcPayouts) {
    const payDate = new Date(payout.payDate);
    if (!isWithinMonth(payDate, monthDate, nextMonth)) continue;
    const converted = await convertAmountValue(
      conversionCache,
      toNumber(payout.amount),
      payout.currency,
      targetCurrency,
      monthDate,
    );
    ltc += converted.amount;
  }

  let equity = 0;
  for (const vest of equityVests) {
    const vestDate = new Date(vest.vestDate);
    if (!isWithinMonth(vestDate, monthDate, nextMonth)) continue;
    const converted = await convertAmountValue(
      conversionCache,
      toNumber(vest.fairValue),
      vest.currency,
      targetCurrency,
      monthDate,
    );
    equity += converted.amount;
  }

  const ssRule = await prisma.cityRuleSS.findFirst({
    where: {
      cityId,
      effectiveFrom: { lte: monthDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: monthDate } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
  let socialInsurance = 0;
  if (ssRule && salaryInfo.amount > 0) {
    const ssCurrency = normalizeCurrency(ssRule.currency);
    const salaryForSS =
      ssCurrency === salaryInfo.currency
        ? salaryInfo.amount
        : (
            await convertAmountValue(
              conversionCache,
              salaryInfo.amount,
              salaryInfo.currency,
              ssCurrency,
              monthDate,
            )
          ).amount;
    const ssBase = clamp(
      salaryForSS,
      toNumber(ssRule.baseMin),
      toNumber(ssRule.baseMax),
    );
    const pension = ssBase * toNumber(ssRule.ratePension);
    const medical =
      ssBase * toNumber(ssRule.rateMedical) +
      toNumber(ssRule.fixedMedicalPersonal);
    const unemployment = ssBase * toNumber(ssRule.rateUnemployment);
    const total = pension + medical + unemployment;
    socialInsurance =
      ssCurrency === targetCurrency
        ? total
        : (
            await convertAmountValue(
              conversionCache,
              total,
              ssCurrency,
              targetCurrency,
              monthDate,
            )
          ).amount;
  }

  const hfRule = await prisma.cityRuleHF.findFirst({
    where: {
      cityId,
      effectiveFrom: { lte: monthDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: monthDate } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
  let housingFund = 0;
  if (hfRule && salaryInfo.amount > 0) {
    const hfCurrency = normalizeCurrency(hfRule.currency);
    const salaryForHF =
      hfCurrency === salaryInfo.currency
        ? salaryInfo.amount
        : (
            await convertAmountValue(
              conversionCache,
              salaryInfo.amount,
              salaryInfo.currency,
              hfCurrency,
              monthDate,
            )
          ).amount;
    const hfBase = clamp(
      salaryForHF,
      toNumber(hfRule.baseMin),
      toNumber(hfRule.baseMax),
    );
    const total = hfBase * toNumber(hfRule.rateEmployee);
    housingFund =
      hfCurrency === targetCurrency
        ? total
        : (
            await convertAmountValue(
              conversionCache,
              total,
              hfCurrency,
              targetCurrency,
              monthDate,
            )
          ).amount;
  }

  const gross = salary + bonus + ltc + equity;
  const year = monthDate.getUTCFullYear();
  const userAnnual = annualDeductionMap.get(year) ?? 0;
  const userSpecialMonthly = userAnnual / 12;
  const specialDeductions = taxContext.special + userSpecialMonthly;

  const taxableCurrent = Math.max(
    0,
    gross -
      socialInsurance -
      housingFund -
      taxContext.standard -
      specialDeductions,
  );

  return {
    monthDate,
    cityId,
    currency: targetCurrency,
    gross,
    bonus,
    ltcIncome: ltc,
    equityIncome: equity,
    socialInsurance,
    housingFund,
    specialDeductions,
    taxableCurrent,
    taxContext,
  };
}

function accumulateTotals(target: TimelineTotals, item: TimelineItem) {
  target.gross += item.gross;
  target.bonus += item.bonus;
  target.ltcIncome += item.ltcIncome;
  target.equityIncome += item.equityIncome;
  target.socialInsurance += item.socialInsurance;
  target.housingFund += item.housingFund;
  target.incomeTax += item.incomeTax;
  target.netIncome += item.netIncome;
}

export async function buildIncomeTimeline(
  userId: string,
  from: string,
  to: string,
  displayCurrency?: string | null,
): Promise<IncomeTimelineResponse> {
  const fromDate = monthStartUTC(new Date(from));
  const toDate = monthStartUTC(new Date(to));
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    throw new Error("invalid_range");
  }
  if (fromDate > toDate) throw new Error("invalid_range");

  await ensureIncomeRecordsForUser(userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { currentCity: true },
  });
  if (!user) {
    throw new Error("user_not_found");
  }
  const requestedDisplayCurrency =
    displayCurrency && displayCurrency.trim().length > 0
      ? displayCurrency.trim().toUpperCase()
      : null;
  const defaultSummaryCurrency = user.displayCurrency ?? "USD";
  const summaryCurrency = normalizeCurrency(
    requestedDisplayCurrency ?? defaultSummaryCurrency,
  );

  const months = enumerateMonths(fromDate, toDate);
  if (months.length === 0) {
    return {
      items: [],
      summary: {
        currency: summaryCurrency,
        counts: { total: 0, actual: 0, forecast: 0 },
        totals: {
          actual: zeroTotals(),
          forecast: zeroTotals(),
          combined: zeroTotals(),
        },
      },
      meta: { range: { from: fromDate.toISOString(), to: toDate.toISOString() } },
    };
  }

  const minYear = months[0].getUTCFullYear();
  const maxYear = months[months.length - 1].getUTCFullYear();

  const [salaryChanges, cityChanges, bonusPlans, ltcPayouts, equityVests, annualDeductions, incomeRecords] =
    await Promise.all([
      prisma.incomeChange.findMany({
        where: { userId },
        orderBy: { effectiveFrom: "asc" },
      }),
      prisma.cityChangeRecord.findMany({
        where: { userId },
        orderBy: { effectiveMonth: "asc" },
      }),
      prisma.bonusPlan.findMany({
        where: {
          userId,
          effectiveDate: {
            gte: new Date(Date.UTC(minYear, 0, 1)),
            lt: new Date(Date.UTC(maxYear + 1, 0, 1)),
          },
        },
      }),
      prisma.longTermCashPayout.findMany({
        where: {
          plan: { userId },
          payDate: {
            gte: new Date(Date.UTC(minYear, 0, 1)),
            lt: new Date(Date.UTC(maxYear + 1, 0, 1)),
          },
        },
      }),
      prisma.equityVest.findMany({
        where: {
          grant: { userId },
          vestDate: {
            gte: new Date(Date.UTC(minYear, 0, 1)),
            lt: new Date(Date.UTC(maxYear + 1, 0, 1)),
          },
        },
      }),
      prisma.userAnnualDeduction.findMany({
        where: {
          userId,
          taxYear: { gte: minYear, lte: maxYear },
        },
      }),
      prisma.incomeRecord.findMany({
        where: {
          userId,
          monthDate: {
            gte: new Date(Date.UTC(minYear, 0, 1)),
            lt: new Date(Date.UTC(maxYear + 1, 0, 1)),
          },
        },
        include: {
          fxSnapshot: {
            select: {
              id: true,
              rate: true,
              capturedAt: true,
            },
          },
        },
        orderBy: { monthDate: "asc" },
      }),
    ]);

  const recordMap = new Map<string, IncomeRecord>();
  incomeRecords.forEach((record) => {
    recordMap.set(monthKey(record.monthDate), record);
  });

  const relevantCityIds = new Set<string>();
  if (user.currentCityId) relevantCityIds.add(user.currentCityId);
  cityChanges.forEach((change) => {
    if (change.toCityId) relevantCityIds.add(change.toCityId);
    if (change.fromCityId) relevantCityIds.add(change.fromCityId);
  });
  incomeRecords.forEach((record) => {
    if (record.cityId) relevantCityIds.add(record.cityId);
  });

  const cityMetas = relevantCityIds.size
    ? await prisma.city.findMany({
        where: { id: { in: Array.from(relevantCityIds) } },
        select: { id: true, country: true },
      })
    : [];
  const cityMetaMap = new Map<string, CityMeta>(
    cityMetas.map((meta) => [meta.id, { id: meta.id, country: meta.country }]),
  );

  const fallbackCityId =
    cityChanges[0]?.fromCityId ??
    user.currentCityId ??
    cityChanges[0]?.toCityId ??
    (incomeRecords.find((record) => record.cityId)?.cityId ?? null);

  if (!fallbackCityId) {
    throw new Error("city_missing");
  }

  if (!cityMetaMap.has(fallbackCityId) && user.currentCity) {
    cityMetaMap.set(fallbackCityId, {
      id: user.currentCity.id,
      country: user.currentCity.country,
    });
  }

  const resolveCity = buildCityResolver(fallbackCityId, cityChanges);

  const annualDeductionMap = new Map<number, number>();
  annualDeductions.forEach((item) => {
    annualDeductionMap.set(item.taxYear, toNumber(item.annualAmount));
  });

  const representativeCountry =
    cityMetaMap.get(fallbackCityId)?.country ??
    user.currentCity?.country ??
    "CN";

  const items: TimelineItem[] = [];
  const conversionCache = new Map<string, ConversionCacheValue>();
  const displayConversionCache = new Map<string, ConversionCacheValue>();

  for (let year = minYear; year <= maxYear; year++) {
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year, 11, 1));
    const taxInputs: Array<TaxComputationInput | null> = new Array(12).fill(
      null,
    );
    const monthlyOutputs: Array<TimelineItem | null> = new Array(12).fill(null);
    const monthlyForecastMeta: Array<ForecastMeta | null> = new Array(12).fill(
      null,
    );

    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const currentMonth = new Date(Date.UTC(year, monthIndex, 1));
      if (currentMonth < yearStart || currentMonth > yearEnd) continue;
      const key = monthKey(currentMonth);
      const record = recordMap.get(key);
      if (record) {
        monthlyOutputs[monthIndex] = toTimelineItem(record);
        const recordCityId = record.cityId ?? resolveCity(currentMonth);
        const recordCity =
          recordCityId && cityMetaMap.has(recordCityId)
            ? cityMetaMap.get(recordCityId)!
            : { id: recordCityId, country: representativeCountry };
        const context = await getTaxContext(recordCity.country, currentMonth);
        taxInputs[monthIndex] = {
          taxable: toNumber(record.taxableCurrent),
          context,
        };
        continue;
      }

      // Skip months outside requested range
      if (
        currentMonth < fromDate ||
        currentMonth > toDate
      ) {
        const cityIdForContext = resolveCity(currentMonth);
        const cityForContext =
          cityIdForContext && cityMetaMap.has(cityIdForContext)
            ? cityMetaMap.get(cityIdForContext)!
            : { id: cityIdForContext, country: representativeCountry };
        const context = await getTaxContext(
          cityForContext.country,
          currentMonth,
        );
        taxInputs[monthIndex] = { taxable: 0, context };
        continue;
      }

      const meta = await computeForecastMeta(
        currentMonth,
        salaryChanges,
        bonusPlans,
        ltcPayouts,
        equityVests,
        resolveCity,
        cityMetaMap,
        annualDeductionMap,
        conversionCache,
      );
      monthlyForecastMeta[monthIndex] = meta;
      taxInputs[monthIndex] = {
        taxable: meta.taxableCurrent,
        context: meta.taxContext,
      };
    }

    const taxResults = computeCumulativeTax(taxInputs);

    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const currentMonth = new Date(Date.UTC(year, monthIndex, 1));
      if (currentMonth < fromDate || currentMonth > toDate) {
        continue;
      }
      const taxInfo = taxResults[monthIndex];
      const existing = monthlyOutputs[monthIndex];
      if (existing) {
        items.push(existing);
        continue;
      }
      const meta = monthlyForecastMeta[monthIndex];
      if (!meta) continue;
      const incomeTax = taxInfo?.monthTax ?? 0;
      const netIncome =
        meta.gross +
        meta.bonus +
        meta.ltcIncome +
        meta.equityIncome -
        meta.socialInsurance -
        meta.housingFund -
        incomeTax;
      items.push({
        recordId: null,
        monthDate: meta.monthDate.toISOString(),
        month: monthKey(meta.monthDate),
        currency: meta.currency,
        recordCurrency: meta.currency,
        sourceCurrency: meta.currency,
        cityId: meta.cityId,
        gross: meta.gross,
        bonus: meta.bonus,
        ltcIncome: meta.ltcIncome,
        equityIncome: meta.equityIncome,
        socialInsurance: meta.socialInsurance,
        housingFund: meta.housingFund,
        specialDeductions: meta.specialDeductions,
        taxableCurrent: meta.taxableCurrent,
        taxableCumulative: taxInfo?.cumulativeTaxable ?? meta.taxableCurrent,
        taxCumulative: taxInfo?.cumulativeTax ?? incomeTax,
        taxPaidCumulative: taxInfo?.cumulativePaid ?? incomeTax,
        incomeTax,
        netIncome,
        source: "forecast",
        isForecast: true,
        manualNet: null,
        manualNote: null,
        fxSnapshotId: null,
        fxSnapshotCapturedAt: null,
        fxAppliedRate: 1,
        displayCurrency: meta.currency,
        displayRate: 1,
      });
    }
  }

  items.sort((a, b) =>
    a.monthDate < b.monthDate ? -1 : a.monthDate > b.monthDate ? 1 : 0,
  );

  const timelineItems =
    requestedDisplayCurrency && summaryCurrency
      ? await Promise.all(
          items.map((item) =>
            convertTimelineItemCurrency(
              item,
              summaryCurrency,
              displayConversionCache,
            ),
          ),
        )
      : items;

  const totalsActual = zeroTotals();
  const totalsForecast = zeroTotals();

  timelineItems.forEach((item) => {
    if (item.isForecast) {
      accumulateTotals(totalsForecast, item);
    } else {
      accumulateTotals(totalsActual, item);
    }
  });

  const combined: TimelineTotals = {
    gross: totalsActual.gross + totalsForecast.gross,
    bonus: totalsActual.bonus + totalsForecast.bonus,
    ltcIncome: totalsActual.ltcIncome + totalsForecast.ltcIncome,
    equityIncome: totalsActual.equityIncome + totalsForecast.equityIncome,
    socialInsurance:
      totalsActual.socialInsurance + totalsForecast.socialInsurance,
    housingFund: totalsActual.housingFund + totalsForecast.housingFund,
    incomeTax: totalsActual.incomeTax + totalsForecast.incomeTax,
    netIncome: totalsActual.netIncome + totalsForecast.netIncome,
  };

  return {
    items: timelineItems,
    summary: {
      currency: summaryCurrency,
      counts: {
        total: timelineItems.length,
        actual: timelineItems.filter((item) => !item.isForecast).length,
        forecast: timelineItems.filter((item) => item.isForecast).length,
      },
      totals: {
        actual: totalsActual,
        forecast: totalsForecast,
        combined,
      },
    },
    meta: {
      range: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      },
    },
  };
}
