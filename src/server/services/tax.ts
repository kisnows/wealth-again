// TaxService: 年度累计个税计算（骨架）
// TODO: 读取 TaxConfig/TaxBracket，按 1..M 累计回算
import prisma from "@/server/db";

export type TaxInputs = {
  country: string;
  taxYear: number;
  monthlyTaxables: number[]; // 长度 12，索引 0 表示 1 月
};

export async function calculateTax({
  country,
  taxYear,
  monthlyTaxables,
}: TaxInputs) {
  const yearStart = new Date(Date.UTC(taxYear, 0, 1));
  const yearEnd = new Date(Date.UTC(taxYear, 11, 31));
  const cfg =
    (await prisma.taxConfig.findFirst({
      where: {
        country,
        effectiveFrom: { lte: yearEnd },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: yearStart } }],
      },
      include: {
        brackets: {
          where: {
            effectiveFrom: { lte: yearEnd },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: yearStart } }],
          },
          orderBy: { position: "asc" },
        },
      },
      orderBy: { effectiveFrom: "desc" },
    })) ??
    (await prisma.taxConfig.findUnique({
      where: { country_taxYear: { country, taxYear } },
      include: { brackets: { orderBy: { position: "asc" } } },
    }));
  if (!cfg) throw new Error("TaxConfig missing");
  let brackets = (cfg as any).brackets as any[] | undefined;
  if (!brackets || brackets.length === 0) {
    brackets = await prisma.taxBracket.findMany({
      where: {
        country,
        taxYear,
        effectiveFrom: { lte: yearEnd },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: yearStart } }],
      },
      orderBy: { position: "asc" },
    });
  }
  if (!brackets || brackets.length === 0)
    throw new Error("TaxBrackets missing");
  const normalized = brackets.map((b: any) => ({
    threshold: Number(b.threshold),
    rate: Number(b.taxRate),
    quick: Number(b.quickDeduction),
  }));
  const results: {
    monthIndex: number;
    monthTax: number;
    cumulativePaid: number;
    cumulativeTaxable: number;
    cumulativeTax: number;
  }[] = [];
  let cumulativeTaxable = 0;
  let cumulativePaid = 0;
  for (let i = 0; i < monthlyTaxables.length; i++) {
    const m = monthlyTaxables[i] || 0;
    cumulativeTaxable += Math.max(0, m);
    // 找到累积档
    const b =
      normalized.find((x) => cumulativeTaxable <= x.threshold) ||
      normalized[normalized.length - 1];
    const cumulativeTax = cumulativeTaxable * b.rate - b.quick;
    const monthTax = Math.max(0, cumulativeTax - cumulativePaid);
    cumulativePaid += monthTax;
    results.push({
      monthIndex: i,
      monthTax,
      cumulativePaid,
      cumulativeTaxable,
      cumulativeTax,
    });
  }
  return results;
}
