import { z } from "zod";

// 保留原有的兼容性导出
export const taxBracketSchema = z.object({
  threshold: z.number(),
  rate: z.number(),
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
