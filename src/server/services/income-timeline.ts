import type {
  BonusPlan,
  CityChangeRecord,
  IncomeChange,
  IncomeRecord,
  LongTermCashPayout,
} from "@prisma/client";
import prisma from "@/server/db";
import { ensureIncomeRecordsForUser } from "@/server/services/income";
import { calculateTax } from "@/server/services/tax";

type TimelineSource = "system" | "manual" | "forecast";

export type TimelineItem = {
  recordId: string | null;
  monthDate: string;
  month: string;
  currency: string;
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

type TaxBaseline = {
  standard: number;
  special: number;
};

async function getTaxBaseline(
  country: string,
  year: number,
  cache: Map<string, TaxBaseline>,
): Promise<TaxBaseline> {
  const key = `${country}-${year}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const config =
    (await prisma.taxConfig.findFirst({
      where: {
        country,
        effectiveFrom: { lte: new Date(Date.UTC(year, 11, 31)) },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gt: new Date(Date.UTC(year, 0, 1)) } },
        ],
      },
      orderBy: { effectiveFrom: "desc" },
    })) ??
    (await prisma.taxConfig.findUnique({
      where: { country_taxYear: { country, taxYear: year } },
    }));
  const standardValue = toNumber(config?.standardDeduction);
  const standard = standardValue > 0 ? standardValue : 5000;
  const special = toNumber(config?.specialAdditionalDeduction);
  const baseline = { standard, special };
  cache.set(key, baseline);
  return baseline;
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
};

function toTimelineItem(record: IncomeRecord): TimelineItem {
  const currency = record.currency || "CNY";
  const manualNet =
    record.manualNet !== null && record.manualNet !== undefined
      ? toNumber(record.manualNet)
      : null;
  const displayNet =
    manualNet !== null ? manualNet : toNumber(record.netIncome);
  return {
    recordId: record.id,
    monthDate: record.monthDate.toISOString(),
    month: monthKey(record.monthDate),
    currency,
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
  };
}

function sumWithinMonth<T extends { [key: string]: unknown }>(
  items: T[],
  dateKey: keyof T,
  monthDate: Date,
  nextMonth: Date,
  amountKey: keyof T,
): number {
  return items
    .filter((item) => {
      const raw = item[dateKey];
      if (!raw) return false;
      const date = new Date(raw as string | Date);
      return date >= monthDate && date < nextMonth;
    })
    .reduce((sum, item) => {
      const rawAmount = item[amountKey];
      return sum + toNumber(rawAmount);
    }, 0);
}

function getSalaryForMonth(
  monthDate: Date,
  nextMonth: Date,
  salaryChanges: IncomeChange[],
): number {
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
  return latest ? toNumber(latest.grossMonthly) : 0;
}

async function computeForecastMeta(
  monthDate: Date,
  salaryChanges: IncomeChange[],
  bonusPlans: BonusPlan[],
  ltcPayouts: LongTermCashPayout[],
  equityVests: EquityVest[],
  resolveCity: (monthDate: Date) => string,
  cityMetaMap: Map<string, CityMeta>,
  country: string,
  taxBaselineCache: Map<string, TaxBaseline>,
  annualDeductionMap: Map<number, number>,
  baseCurrency: string,
): Promise<ForecastMeta> {
  const nextMonth = addMonths(monthDate, 1);
  const salary = getSalaryForMonth(monthDate, nextMonth, salaryChanges);
  const bonus = sumWithinMonth(
    bonusPlans,
    "effectiveDate",
    monthDate,
    nextMonth,
    "amount",
  );
  const ltc = sumWithinMonth(
    ltcPayouts,
    "payDate",
    monthDate,
    nextMonth,
    "amount",
  );
  const equity = sumWithinMonth(
    equityVests,
    "vestDate",
    monthDate,
    nextMonth,
    "fairValue",
  );

  const cityId = resolveCity(monthDate);
  const ssRule = await prisma.cityRuleSS.findFirst({
    where: {
      cityId,
      effectiveFrom: { lte: monthDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: monthDate } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
  const hfRule = await prisma.cityRuleHF.findFirst({
    where: {
      cityId,
      effectiveFrom: { lte: monthDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: monthDate } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });

  const gross = salary + bonus + ltc + equity;
  const ssBase =
    ssRule && salary > 0
      ? clamp(salary, toNumber(ssRule.baseMin), toNumber(ssRule.baseMax))
      : salary;
  const hfBase =
    hfRule && salary > 0
      ? clamp(salary, toNumber(hfRule.baseMin), toNumber(hfRule.baseMax))
      : salary;

  const pension = ssRule ? ssBase * toNumber(ssRule.ratePension) : 0;
  const medical = ssRule
    ? ssBase * toNumber(ssRule.rateMedical) + toNumber(ssRule.fixedMedicalPersonal)
    : 0;
  const unemployment = ssRule
    ? ssBase * toNumber(ssRule.rateUnemployment)
    : 0;
  const socialInsurance = pension + medical + unemployment;
  const housingFund = hfRule ? hfBase * toNumber(hfRule.rateEmployee) : 0;

  const year = monthDate.getUTCFullYear();
  const baseline = await getTaxBaseline(
    country,
    year,
    taxBaselineCache,
  );
  const userAnnual = annualDeductionMap.get(year) ?? 0;
  const userSpecialMonthly = userAnnual / 12;
  const specialDeductions = baseline.special + userSpecialMonthly;

  const taxableCurrent = Math.max(
    0,
    gross - socialInsurance - housingFund - baseline.standard - specialDeductions,
  );

  const currency = baseCurrency || "CNY";

  return {
    monthDate,
    cityId,
    currency,
    gross,
    bonus,
    ltcIncome: ltc,
    equityIncome: equity,
    socialInsurance,
    housingFund,
    specialDeductions,
    taxableCurrent,
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

  const months = enumerateMonths(fromDate, toDate);
  if (months.length === 0) {
    return {
      items: [],
      summary: {
        currency: user.baseCurrency ?? "CNY",
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

  const taxBaselineCache = new Map<string, TaxBaseline>();
  const representativeCountry =
    cityMetaMap.get(fallbackCityId)?.country ??
    user.currentCity?.country ??
    "CN";

  const items: TimelineItem[] = [];

  for (let year = minYear; year <= maxYear; year++) {
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year, 11, 1));
    const monthlyTaxables = new Array(12).fill(0);
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
        monthlyTaxables[monthIndex] = toNumber(record.taxableCurrent);
        monthlyOutputs[monthIndex] = toTimelineItem(record);
        continue;
      }

      // Skip months outside requested range
      if (
        currentMonth < fromDate ||
        currentMonth > toDate
      ) {
        monthlyTaxables[monthIndex] = 0;
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
        representativeCountry,
        taxBaselineCache,
        annualDeductionMap,
        user.baseCurrency ?? "CNY",
      );
      monthlyTaxables[monthIndex] = meta.taxableCurrent;
      monthlyForecastMeta[monthIndex] = meta;
    }

    const taxResults = await calculateTax({
      country: representativeCountry,
      taxYear: year,
      monthlyTaxables,
    });

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
        currency: user.baseCurrency ?? meta.currency ?? "CNY",
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
      });
    }
  }

  items.sort((a, b) =>
    a.monthDate < b.monthDate ? -1 : a.monthDate > b.monthDate ? 1 : 0,
  );

  const totalsActual = zeroTotals();
  const totalsForecast = zeroTotals();

  items.forEach((item) => {
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
    items,
    summary: {
      currency: user.baseCurrency ?? "CNY",
      counts: {
        total: items.length,
        actual: items.filter((item) => !item.isForecast).length,
        forecast: items.filter((item) => item.isForecast).length,
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
