import { TaxConfigRepository } from "./repository";
import { TaxCalculator, SocialInsuranceCalculator, round2 } from "./calculator";
import {
  IncomeCalculationInput,
  IncomeCalculationResult,
  TaxConfig,
} from "./types";

export class TaxService {
  constructor(private repository: TaxConfigRepository) {}

  /**
   * 计算月度个税和社保
   */
  async calculateMonthlyIncome(
    input: IncomeCalculationInput
  ): Promise<IncomeCalculationResult> {
    const calculationDate = new Date(input.year, input.month - 1, 1);

    // 1. 获取税率配置
    const taxBrackets = await this.repository.getTaxBrackets(
      input.city,
      calculationDate
    );
    if (taxBrackets.length === 0) {
      throw new Error(
        `未找到城市 ${input.city} 在 ${input.year}-${input.month} 的税率配置`
      );
    }

    // 2. 获取社保配置
    const socialConfig = await this.repository.getSocialInsuranceConfig(
      input.city,
      calculationDate
    );
    if (!socialConfig) {
      throw new Error(
        `未找到城市 ${input.city} 在 ${input.year}-${input.month} 的社保配置`
      );
    }

    // 3. 初始化计算器
    const taxCalculator = new TaxCalculator(taxBrackets);
    const socialCalculator = new SocialInsuranceCalculator(socialConfig);

    // 4. 计算社保公积金
    const socialInsurance = socialCalculator.calculateSocialInsurance(
      input.gross,
      input.customSocialInsuranceBase || undefined
    );
    const housingFund = socialCalculator.calculateHousingFund(
      input.gross,
      input.customHousingFundBase || undefined
    );

    // 5. 计算应纳税所得额
    const monthlyBasicDeduction = 5000; // 月度基本减除费用
    const taxableIncome = Math.max(
      0,
      input.gross +
        input.bonus -
        monthlyBasicDeduction -
        socialInsurance.total -
        housingFund.amount -
        input.specialDeductions -
        input.otherDeductions -
        input.charityDonations
    );

    // 6. 计算个税
    const { tax, bracket } = taxCalculator.calculateTax(taxableIncome);

    // 7. 计算税后收入
    const netIncome =
      input.gross +
      input.bonus -
      socialInsurance.total -
      housingFund.amount -
      tax;

    // 8. 计算实际税率
    const totalIncome = input.gross + input.bonus;
    const effectiveTaxRate = totalIncome > 0 ? (tax / totalIncome) * 100 : 0;

    // 9. 保存计算结果
    await this.repository.saveIncomeRecord({
      userId: input.userId,
      year: input.year,
      month: input.month,
      city: input.city,
      gross: input.gross,
      bonus: input.bonus,
      socialInsuranceBase: socialInsurance.base,
      housingFundBase: housingFund.base,
      socialInsurance: socialInsurance.total,
      housingFund: housingFund.amount,
      specialDeductions: input.specialDeductions,
      otherDeductions: input.otherDeductions,
      charityDonations: input.charityDonations,
      taxableIncome: taxableIncome,
      incomeTax: tax,
      netIncome: netIncome,
    });

    return {
      month: input.month,
      grossIncome: round2(input.gross),
      bonus: round2(input.bonus),
      socialInsuranceBase: round2(socialInsurance.base),
      housingFundBase: round2(housingFund.base),
      socialInsurance: round2(socialInsurance.total),
      housingFund: round2(housingFund.amount),
      specialDeductions: round2(input.specialDeductions),
      otherDeductions: round2(input.otherDeductions),
      charityDonations: round2(input.charityDonations),
      taxableIncome: round2(taxableIncome),
      incomeTax: round2(tax),
      netIncome: round2(netIncome),
      taxConfigVersion: `${input.city}-${input.year}-${input.month}`,
      effectiveTaxRate: round2(effectiveTaxRate),
      appliedTaxBracket: {
        rate: bracket.taxRate * 100, // 转换为百分比
        quickDeduction: bracket.quickDeduction,
      },
    };
  }

  /**
   * 方案B：使用服务层逐月计算社保/公积金与税务配置，自行按累计预扣法计算个税
   * 注意：社保、公积金基数以工资为基（不含奖金）；税前=工资+奖金；税后=税前-社保-税
   */
  async calculateForecastWithholdingCumulative(args: {
    city: string;
    months: Array<{
      year: number;
      month: number;
      gross: number;
      bonus?: number;
    }>;
  }): Promise<
    Array<{
      month: number;
      ym: string;
      grossThisMonth: number;
      cumulativeIncome: number;
      socialInsuranceThisMonth: number;
      housingFundThisMonth: number;
      totalDeductionsThisMonth: number;
      taxThisMonth: number;
      net: number;
      appliedTaxRate: number; // 百分比
      paramsSig: string;
    }>
  > {
    const ordered = [...args.months].sort((a, b) =>
      a.year === b.year ? a.month - b.month : a.year - b.year
    );
    let cumulativeGross = 0;
    let cumulativeSIHF = 0;
    const monthlyBasicDeduction = 5000;
    let cumulativeTaxed = 0;

    const results: Array<{
      month: number;
      ym: string;
      grossThisMonth: number;
      cumulativeIncome: number;
      socialInsuranceThisMonth: number;
      housingFundThisMonth: number;
      totalDeductionsThisMonth: number;
      taxThisMonth: number;
      net: number;
      appliedTaxRate: number;
      paramsSig: string;
    }> = [];

    for (let i = 0; i < ordered.length; i++) {
      const { year, month, gross, bonus = 0 } = ordered[i];
      const asOf = new Date(year, month, 0);

      // 读取当月配置
      const taxBrackets = await this.repository.getTaxBrackets(args.city, asOf);
      const socialConfig = await this.repository.getSocialInsuranceConfig(
        args.city,
        asOf
      );
      if (taxBrackets.length === 0 || !socialConfig) {
        throw new Error(
          `缺少 ${args.city} 在 ${year}-${month} 的税务或社保配置`
        );
      }

      const taxCalc = new TaxCalculator(taxBrackets);
      const socialCalc = new SocialInsuranceCalculator(socialConfig);

      // 社保/公积金仅按工资计提
      const si = socialCalc.calculateSocialInsurance(gross, undefined);
      const hf = socialCalc.calculateHousingFund(gross, undefined);
      const sihfThisMonth = si.total + hf.amount;

      // 累计口径数据
      const monthGross = gross + bonus;
      cumulativeGross += monthGross;
      cumulativeSIHF += sihfThisMonth;
      const monthsElapsed = i + 1;
      const taxableCumulative = Math.max(
        0,
        cumulativeGross - cumulativeSIHF - monthlyBasicDeduction * monthsElapsed
      );
      const calc = taxCalc.calculateTax(taxableCumulative);
      const taxDueCumulative = calc.tax;
      // 累计预扣：当期应预扣=累计应纳税额-累计已预扣；若为负则当期不预扣，负数结转后续抵减
      const delta = taxDueCumulative - cumulativeTaxed;
      const taxThisMonth = Math.max(0, delta);
      // 当累计应纳税额下降（delta<0）时，不显示负税，但将累计已预扣基线同步到“当前应缴”
      // 这样后续月份在新配置下会重新累计，而不会长时间为 0
      cumulativeTaxed = Math.min(
        taxDueCumulative,
        cumulativeTaxed + taxThisMonth
      );

      const net = monthGross - sihfThisMonth - taxThisMonth;

      const paramsSig = taxBrackets
        .map((b) => `${b.minIncome}-${b.taxRate}-${b.quickDeduction}`)
        .join("|");

      results.push({
        month,
        ym: `${year}-${String(month).padStart(2, "0")}`,
        grossThisMonth: round2(monthGross),
        cumulativeIncome: round2(cumulativeGross),
        socialInsuranceThisMonth: round2(si.total),
        housingFundThisMonth: round2(hf.amount),
        totalDeductionsThisMonth: round2(sihfThisMonth),
        taxThisMonth: round2(taxThisMonth),
        net: round2(net),
        appliedTaxRate: round2(calc.bracket.taxRate * 100),
        paramsSig,
      });
    }

    return results;
  }

  /**
   * 获取年度收入汇总
   */
  async getAnnualSummary(userId: string, year: number) {
    const records = await this.repository.getAnnualIncomeRecords(userId, year);

    if (records.length === 0) {
      return null;
    }

    const summary = records.reduce(
      (acc, record) => ({
        totalGross: acc.totalGross + Number(record.gross),
        totalBonus: acc.totalBonus + Number(record.bonus || 0),
        totalSocialInsurance:
          acc.totalSocialInsurance + Number(record.socialInsurance || 0),
        totalHousingFund:
          acc.totalHousingFund + Number(record.housingFund || 0),
        totalSpecialDeductions:
          acc.totalSpecialDeductions + Number(record.specialDeductions || 0),
        totalOtherDeductions:
          acc.totalOtherDeductions + Number(record.otherDeductions || 0),
        totalCharityDonations:
          acc.totalCharityDonations + Number(record.charityDonations || 0),
        totalTaxableIncome:
          acc.totalTaxableIncome + Number(record.taxableIncome || 0),
        totalIncomeTax: acc.totalIncomeTax + Number(record.incomeTax || 0),
        totalNetIncome: acc.totalNetIncome + Number(record.netIncome || 0),
      }),
      {
        totalGross: 0,
        totalBonus: 0,
        totalSocialInsurance: 0,
        totalHousingFund: 0,
        totalSpecialDeductions: 0,
        totalOtherDeductions: 0,
        totalCharityDonations: 0,
        totalTaxableIncome: 0,
        totalIncomeTax: 0,
        totalNetIncome: 0,
      }
    );

    const totalIncome = summary.totalGross + summary.totalBonus;
    const effectiveTaxRate =
      totalIncome > 0 ? (summary.totalIncomeTax / totalIncome) * 100 : 0;

    return {
      year,
      monthCount: records.length,
      ...summary,
      effectiveTaxRate: round2(effectiveTaxRate),
      records: records.map((record) => ({
        month: record.month,
        gross: Number(record.gross),
        bonus: Number(record.bonus || 0),
        incomeTax: Number(record.incomeTax || 0),
        netIncome: Number(record.netIncome || 0),
      })),
    };
  }

  /**
   * 保存税务配置
   */
  async saveTaxConfig(config: TaxConfig): Promise<void> {
    const { city, effectiveFrom, effectiveTo, taxBrackets, socialInsurance } =
      config;

    await Promise.all([
      this.repository.saveTaxBrackets(
        city,
        taxBrackets,
        effectiveFrom,
        effectiveTo || undefined
      ),
      this.repository.saveSocialInsuranceConfig(
        city,
        socialInsurance,
        effectiveFrom,
        effectiveTo || undefined
      ),
    ]);
  }

  /**
   * 获取城市配置历史
   */
  async getTaxConfigHistory(city: string, limit: number = 10) {
    return this.repository.getTaxConfigHistory(city, limit);
  }

  /**
   * 获取当前有效的税务配置
   */
  async getCurrentTaxConfig(
    city: string,
    date: Date = new Date()
  ): Promise<{
    taxBrackets: any[];
    socialInsurance: any;
  } | null> {
    const [taxBrackets, socialInsurance] = await Promise.all([
      this.repository.getTaxBrackets(city, date),
      this.repository.getSocialInsuranceConfig(city, date),
    ]);

    if (taxBrackets.length === 0 || !socialInsurance) {
      return null;
    }

    return {
      taxBrackets,
      socialInsurance,
    };
  }

  /**
   * 批量导入杭州税务参数（兼容原有逻辑）
   */
  async importHangzhouParams(params: {
    year: number;
    city: string;
    monthlyBasicDeduction: number;
    brackets: Array<{
      threshold: number;
      rate: number;
      quickDeduction: number;
    }>;
    sihfRates: Record<string, number>; // 改为更灵活的类型
    sihfBase: {
      min: number;
      max: number;
    };
    housingFund?: {
      rate: number;
      baseMin: number;
      baseMax: number;
    };
  }) {
    const effectiveFrom = new Date(`${params.year}-01-01`);

    // 转换税率档次
    const taxBrackets = params.brackets.map((bracket, index) => {
      const nextBracket = params.brackets[index + 1];
      return {
        minIncome: bracket.threshold,
        maxIncome: nextBracket ? nextBracket.threshold : null,
        taxRate: bracket.rate,
        quickDeduction: bracket.quickDeduction,
      };
    });

    // 转换社保配置
    const socialInsurance = {
      socialMinBase: params.sihfBase.min,
      socialMaxBase: params.sihfBase.max,
      pensionRate: params.sihfRates.pension || 0.08,
      medicalRate: params.sihfRates.medical || 0.02,
      unemploymentRate: params.sihfRates.unemployment || 0.005,
      housingFundMinBase: params.housingFund?.baseMin || params.sihfBase.min,
      housingFundMaxBase: params.housingFund?.baseMax || params.sihfBase.max,
      housingFundRate: params.housingFund?.rate || 0.12,
    };

    // 保存配置
    await this.saveTaxConfig({
      city: params.city,
      effectiveFrom,
      effectiveTo: null,
      monthlyBasicDeduction: params.monthlyBasicDeduction,
      taxBrackets,
      socialInsurance,
    });

    return { success: true, effectiveFrom };
  }
}
