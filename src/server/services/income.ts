import prisma from "@/server/db";
import { calculateTax } from "@/server/services/tax";

type RecalcParams = { taxYear: number; endMonth: number; cityId?: string };

export async function recalcIncome({ taxYear, endMonth, cityId }: RecalcParams) {
  const users = await prisma.user.findMany({ include: { currentCity: true } });
  let updated = 0;
  for (const user of users) {
    const city = cityId || user.currentCityId;
    const monthlyTaxables: number[] = new Array(12).fill(0);
    const monthRecords: any[] = [];
    for (let m = 1; m <= endMonth; m++) {
      const monthDate = new Date(Date.UTC(taxYear, m - 1, 1, 0, 0, 0));
      // 工资：取生效<=当月的最新一条
      const incomeChange = await prisma.incomeChange.findFirst({
        where: { userId: user.id, effectiveFrom: { lte: monthDate } },
        orderBy: { effectiveFrom: "desc" },
      });
      const gross = Number(incomeChange?.grossMonthly || 0);
      // 奖金：当月
      const bonus = (await prisma.bonusPlan.findMany({ where: { userId: user.id, effectiveDate: { gte: monthDate, lt: new Date(Date.UTC(taxYear, m, 1)) } } }))
        .reduce((s, b) => s + Number(b.amount), 0);
      // LTC：当月
      const ltcIncome = (await prisma.longTermCashPayout.findMany({ where: { plan: { userId: user.id }, payDate: { gte: monthDate, lt: new Date(Date.UTC(taxYear, m, 1)) } } }))
        .reduce((s, p) => s + Number(p.amount), 0);
      // Equity：当月已回填 fairValue
      const equityIncome = (await prisma.equityVest.findMany({ where: { grant: { userId: user.id }, vestDate: { gte: monthDate, lt: new Date(Date.UTC(taxYear, m, 1)) }, fairValue: { not: null } } }))
        .reduce((s, v) => s + Number(v.fairValue || 0), 0);
      // 社保基数与金额
      const ssRule = await prisma.cityRuleSS.findFirst({ where: { cityId: city, startDate: { lte: monthDate }, OR: [{ endDate: null }, { endDate: { gt: monthDate } }] }, orderBy: { startDate: "desc" } });
      const hfRule = await prisma.cityRuleHF.findFirst({ where: { cityId: city, startDate: { lte: monthDate }, OR: [{ endDate: null }, { endDate: { gt: monthDate } }] }, orderBy: { startDate: "desc" } });
      const clamp = (x: number, min: number, max: number) => Math.max(Number(min), Math.min(Number(max), x));
      const ssBase = ssRule ? clamp(gross, Number(ssRule.baseMin), Number(ssRule.baseMax)) : 0;
      const hfBase = hfRule ? clamp(gross, Number(hfRule.baseMin), Number(hfRule.baseMax)) : 0;
      const socialInsurance = ssRule ? ssBase * (Number(ssRule.ratePension) + Number(ssRule.rateMedical) + Number(ssRule.rateUnemployment)) : 0;
      const housingFund = hfRule ? hfBase * Number(hfRule.rateEmployee) : 0;
      // 标准扣除（按国家+税年）
      const cfg = await prisma.taxConfig.findUnique({ where: { country_taxYear: { country: user.currentCity.country, taxYear } } });
      const standard = Number(cfg?.standardDeduction || 0);
      const taxable = Math.max(0, gross + bonus + ltcIncome + equityIncome - socialInsurance - housingFund - standard);
      monthlyTaxables[m - 1] = taxable;
      monthRecords.push({ monthDate, gross, bonus, ltcIncome, equityIncome, socialInsurance, housingFund, standard });
    }
    const taxRes = await calculateTax({ country: user.currentCity.country, taxYear, monthlyTaxables });
    for (let i = 0; i < endMonth; i++) {
      const r = monthRecords[i];
      const t = taxRes[i];
      const net = r.gross + r.bonus + r.ltcIncome + r.equityIncome - r.socialInsurance - r.housingFund - t.monthTax;
      await prisma.incomeRecord.upsert({
        where: { userId_monthDate: { userId: user.id, monthDate: r.monthDate } },
        update: {
          cityId: city,
          currency: user.baseCurrency,
          gross: r.gross,
          bonus: r.bonus,
          ltcIncome: r.ltcIncome,
          equityIncome: r.equityIncome,
          socialInsurance: r.socialInsurance,
          housingFund: r.housingFund,
          taxableIncome: monthlyTaxables[i],
          incomeTax: t.monthTax,
          taxPaid: t.cumulativePaid,
          netIncome: net,
          isForecast: false,
        },
        create: {
          userId: user.id,
          monthDate: r.monthDate,
          cityId: city,
          currency: user.baseCurrency,
          gross: r.gross,
          bonus: r.bonus,
          ltcIncome: r.ltcIncome,
          equityIncome: r.equityIncome,
          socialInsurance: r.socialInsurance,
          housingFund: r.housingFund,
          taxableIncome: monthlyTaxables[i],
          incomeTax: t.monthTax,
          taxPaid: t.cumulativePaid,
          netIncome: net,
          isForecast: false,
        },
      });
      updated++;
    }
  }
  return { updated } as const;
}
