import db from "@/server/db";
import { taxBracket, taxConfig } from "@/server/db/schema";
import { and, asc, desc, eq, gt, isNull, lte, or } from "drizzle-orm";

export type TaxInputs = {
  country: string;
  taxYear: number;
  monthlyTaxables: number[];
};

type TaxBracketInfo = {
  threshold: number;
  rate: number;
  quick: number;
};

export type TaxContext = {
  id: string;
  country: string;
  taxYear: number;
  currency: string;
  standard: number;
  special: number;
  brackets: TaxBracketInfo[];
};

export type TaxComputationInput = {
  taxable: number;
  context: TaxContext;
};

export type TaxComputationResult = {
  monthTax: number;
  cumulativePaid: number;
  cumulativeTaxable: number;
  cumulativeTax: number;
};

const taxContextCache = new Map<string, TaxContext>();

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

function normalizeCountry(country: string) {
  return country.toUpperCase();
}

async function fetchTaxConfig(
  country: string,
  at: Date,
  taxYear: number,
) {
  const [record] = await db
    .select()
    .from(taxConfig)
    .where(
      and(
        eq(taxConfig.country, country),
        lte(taxConfig.effectiveFrom, at),
        or(isNull(taxConfig.effectiveTo), gt(taxConfig.effectiveTo, at)),
      ),
    )
    .orderBy(desc(taxConfig.effectiveFrom))
    .limit(1);
  if (record) return record;
  const [fallback] = await db
    .select()
    .from(taxConfig)
    .where(and(eq(taxConfig.country, country), eq(taxConfig.taxYear, taxYear)))
    .limit(1);
  return fallback ?? null;
}

async function fetchFallbackBrackets(
  country: string,
  taxYear: number,
  at: Date,
) {
  const rows = await db
    .select()
    .from(taxBracket)
    .where(
      and(
        eq(taxBracket.country, country),
        eq(taxBracket.taxYear, taxYear),
        lte(taxBracket.effectiveFrom, at),
        or(isNull(taxBracket.effectiveTo), gt(taxBracket.effectiveTo, at)),
      ),
    )
    .orderBy(asc(taxBracket.position));
  if (Array.isArray(rows) && rows.length > 0) return rows;
  const fallback = await db
    .select()
    .from(taxBracket)
    .where(and(eq(taxBracket.country, country), eq(taxBracket.taxYear, taxYear)))
    .orderBy(asc(taxBracket.position));
  return Array.isArray(fallback) ? fallback : [];
}

export async function getTaxContext(
  countryInput: string,
  at: Date,
): Promise<TaxContext> {
  const normalizedCountry = normalizeCountry(countryInput);
  const key = `${normalizedCountry}::${monthKey(at)}`;
  const cached = taxContextCache.get(key);
  if (cached) return cached;
  const taxYear = at.getUTCFullYear();
  const configRecord = await fetchTaxConfig(normalizedCountry, at, taxYear);
  if (!configRecord) {
    throw new Error(
      `tax_config_missing:${normalizedCountry}:${taxYear}:${at.toISOString()}`,
    );
  }
  const bracketsRaw =
    await fetchFallbackBrackets(
      normalizedCountry,
      configRecord.taxYear ?? taxYear,
      at,
    );
  if (!Array.isArray(bracketsRaw) || bracketsRaw.length === 0) {
    throw new Error(
      `tax_brackets_missing:${normalizedCountry}:${taxYear}:${at.toISOString()}`,
    );
  }
  const brackets = bracketsRaw.map((item: any) => ({
    threshold: toNumber(item.threshold),
    rate: toNumber(item.taxRate),
    quick: toNumber(item.quickDeduction),
  }));
  const context: TaxContext = {
    id: configRecord.id ?? `${normalizedCountry}-${taxYear}`,
    country: configRecord.country ?? normalizedCountry,
    taxYear: configRecord.taxYear ?? taxYear,
    currency: (configRecord.currency ?? "CNY").toUpperCase(),
    standard:
      configRecord.standardDeduction !== undefined &&
      configRecord.standardDeduction !== null
        ? toNumber(configRecord.standardDeduction)
        : 5000,
    special: toNumber(configRecord.specialAdditionalDeduction),
    brackets,
  };
  taxContextCache.set(key, context);
  return context;
}

function selectBracket(brackets: TaxBracketInfo[], taxable: number) {
  if (brackets.length === 0) {
    throw new Error("tax_brackets_empty");
  }
  const found =
    brackets.find((item) => taxable <= item.threshold) ??
    brackets[brackets.length - 1];
  return found;
}

export function computeCumulativeTax(
  inputs: Array<TaxComputationInput | null>,
): Array<TaxComputationResult | null> {
  const results: Array<TaxComputationResult | null> = new Array(
    inputs.length,
  ).fill(null);
  let currentContextId: string | null = null;
  let cumulativeTaxable = 0;
  let cumulativePaid = 0;
  for (let index = 0; index < inputs.length; index++) {
    const input = inputs[index];
    if (!input) continue;
    const { context, taxable } = input;
    const normalizedTaxable = Math.max(0, taxable || 0);
    if (context.id !== currentContextId) {
      currentContextId = context.id;
      cumulativeTaxable = 0;
      cumulativePaid = 0;
    }
    cumulativeTaxable += normalizedTaxable;
    const bracket = selectBracket(context.brackets, cumulativeTaxable);
    const cumulativeTax = cumulativeTaxable * bracket.rate - bracket.quick;
    const monthTax = Math.max(0, cumulativeTax - cumulativePaid);
    cumulativePaid += monthTax;
    results[index] = {
      monthTax,
      cumulativePaid,
      cumulativeTaxable,
      cumulativeTax,
    };
  }
  return results;
}

export async function calculateTax({
  country,
  taxYear,
  monthlyTaxables,
}: TaxInputs) {
  const inputs: Array<TaxComputationInput | null> = [];
  for (let i = 0; i < monthlyTaxables.length; i++) {
    const taxable = monthlyTaxables[i] ?? 0;
    const context = await getTaxContext(
      country,
      new Date(Date.UTC(taxYear, i, 1, 0, 0, 0)),
    );
    inputs.push({ taxable, context });
  }
  const computations = computeCumulativeTax(inputs);
  const results: {
    monthIndex: number;
    monthTax: number;
    cumulativePaid: number;
    cumulativeTaxable: number;
    cumulativeTax: number;
  }[] = [];
  let fallbackPaid = 0;
  let fallbackTaxable = 0;
  let fallbackTax = 0;
  for (let index = 0; index < computations.length; index++) {
    const item = computations[index];
    const monthTax = item?.monthTax ?? 0;
    const cumulativePaid = item?.cumulativePaid ?? fallbackPaid;
    const cumulativeTaxable = item?.cumulativeTaxable ?? fallbackTaxable;
    const cumulativeTax = item?.cumulativeTax ?? fallbackTax;
    results.push({
      monthIndex: index,
      monthTax,
      cumulativePaid,
      cumulativeTaxable,
      cumulativeTax,
    });
    fallbackPaid = cumulativePaid;
    fallbackTaxable = cumulativeTaxable;
    fallbackTax = cumulativeTax;
  }
  return results;
}

export function clearTaxContextCache() {
  taxContextCache.clear();
}
