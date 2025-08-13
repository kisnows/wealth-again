import { z } from "zod";

// 保留原有的兼容性导出
export const taxBracketSchema = z.object({
  threshold: z.number(), // cumulative taxable income threshold
  rate: z.number(), // 0-1
  quickDeduction: z.number(),
});

export const taxParamsSchema = z.object({
  city: z.string(),
  year: z.number(),
  brackets: z.array(taxBracketSchema).min(1),
  monthlyBasicDeduction: z.number(),
  sihfRates: z.record(z.number()).default({}),
  sihfBase: z.object({ min: z.number(), max: z.number() }),
  housingFund: z
    .object({ rate: z.number(), baseMin: z.number(), baseMax: z.number() })
    .optional(),
  specialDeductions: z.record(z.number()).default({}),
});

export type TaxParams = z.infer<typeof taxParamsSchema>;

// 重新导出新的税务模块
export * from "./tax/index";

// 原有的计算函数继续保留（向后兼容）

export interface MonthlyIncomeInput {
  month: number; // 1-12
  gross: number; // salary
  bonus?: number; // discretionary bonus in that month (if merged into comprehensive)
  overrides?: Partial<TaxParams>; // allow param override for that month
}

export interface MonthlyResult {
  month: number;
  taxableCumulative: number;
  taxDueCumulative: number;
  taxThisMonth: number;
  net: number;
  paramsVersionKey: string;
  grossThisMonth?: number;
}

export function calcMonthlyWithholdingCumulative(
  months: MonthlyIncomeInput[],
  baseParams: TaxParams,
  opts?: { mergeBonusIntoComprehensive?: boolean }
): MonthlyResult[] {
  // sort months just in case
  const ordered = [...months].sort((a, b) => a.month - b.month);
  const results: MonthlyResult[] = [];
  let cumulativeGross = 0;
  let cumulativeSpecial = 0;
  let cumulativeSIHF = 0;
  let cumulativeTaxed = 0;
  const monthlyBasic = baseParams.monthlyBasicDeduction;
  const specialPerMonth = Object.values(
    baseParams.specialDeductions || {}
  ).reduce<number>((a, b) => a + (b as number), 0);
  for (const m of ordered) {
    const effective = { ...baseParams, ...(m.overrides || {}) } as TaxParams;
    const monthGross =
      m.gross + (opts?.mergeBonusIntoComprehensive ? m.bonus || 0 : 0);
    cumulativeGross += monthGross;
    cumulativeSpecial += specialPerMonth; // simple: treat overrides ignored for brevity
    // simplistic SIHF: apply rate sum to capped base = min(maxBase, max(minBase, gross))
    const sihfRateSum = Object.values(effective.sihfRates || {}).reduce<number>(
      (a, b) => a + (b as number),
      0
    );
    const contributionBase = Math.min(
      effective.sihfBase.max,
      Math.max(effective.sihfBase.min, monthGross)
    );
    const sihfThisMonth = contributionBase * sihfRateSum;
    cumulativeSIHF += sihfThisMonth;
    const monthsElapsed = m.month; // assume contiguous
    const taxableCumulative =
      cumulativeGross -
      cumulativeSIHF -
      cumulativeSpecial -
      monthlyBasic * monthsElapsed;
    const taxDueCumulative = calcCumulativeTax(
      taxableCumulative,
      effective.brackets
    );
    const taxThisMonth = taxDueCumulative - cumulativeTaxed;
    cumulativeTaxed = taxDueCumulative;
    const net = monthGross - sihfThisMonth - taxThisMonth; // ignore housing fund etc.
    results.push({
      month: m.month,
      taxableCumulative: round2(taxableCumulative),
      taxDueCumulative: round2(taxDueCumulative),
      taxThisMonth: round2(taxThisMonth),
      net: round2(net),
      paramsVersionKey: `${effective.city}-${effective.year}`,
      grossThisMonth: round2(monthGross),
    });
  }
  return results;
}

export function normalizeTaxParamsValue(raw: unknown): TaxParams {
  try {
    if (typeof raw === "string") {
      const parsed = JSON.parse(raw);
      return taxParamsSchema.parse(parsed);
    }
    return taxParamsSchema.parse(raw);
  } catch (e) {
    throw e;
  }
}

function calcCumulativeTax(
  taxable: number,
  brackets: TaxParams["brackets"]
): number {
  if (taxable <= 0) return 0;
  // brackets assumed ascending by threshold
  let applicable = brackets[0];
  for (const b of brackets) {
    if (taxable >= b.threshold) applicable = b;
    else break;
  }
  return taxable * applicable.rate - applicable.quickDeduction;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
