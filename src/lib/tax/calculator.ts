import type { SocialInsuranceConfig, TaxBracket } from "./types";

/**
 * 个人所得税计算器
 */
export class TaxCalculator {
  constructor(private taxBrackets: TaxBracket[]) {
    // 确保税率档次按收入阈值升序排列
    this.taxBrackets.sort((a, b) => a.minIncome - b.minIncome);
  }

  /**
   * 计算个人所得税
   * @param taxableIncome 应纳税所得额
   */
  calculateTax(taxableIncome: number): { tax: number; bracket: TaxBracket } {
    if (taxableIncome <= 0) {
      return { tax: 0, bracket: this.taxBrackets[0] };
    }

    // 查找适用的税率档次
    const bracket = this.findApplicableBracket(taxableIncome);

    // 计算应纳税额 = 应纳税所得额 × 税率 - 速算扣除数
    const tax = Math.max(0, taxableIncome * bracket.taxRate - bracket.quickDeduction);

    return { tax, bracket };
  }

  /**
   * 查找适用的税率档次
   */
  private findApplicableBracket(taxableIncome: number): TaxBracket {
    for (let i = this.taxBrackets.length - 1; i >= 0; i--) {
      const bracket = this.taxBrackets[i];
      if (
        taxableIncome >= bracket.minIncome &&
        (bracket.maxIncome === null || taxableIncome < bracket.maxIncome)
      ) {
        return bracket;
      }
    }

    // 默认返回最低档次
    return this.taxBrackets[0];
  }

  /**
   * 计算年度应纳税额（用于年度汇算）
   */
  calculateAnnualTax(annualTaxableIncome: number): {
    tax: number;
    bracket: TaxBracket;
  } {
    return this.calculateTax(annualTaxableIncome);
  }
}

/**
 * 社保公积金计算器
 */
export class SocialInsuranceCalculator {
  constructor(private config: SocialInsuranceConfig) {}

  /**
   * 计算社保缴费金额
   */
  calculateSocialInsurance(
    grossIncome: number,
    customBase?: number,
  ): {
    base: number;
    pension: number;
    medical: number;
    unemployment: number;
    total: number;
  } {
    const base = customBase || this.calculateSocialInsuranceBase(grossIncome);

    const pension = base * this.config.pensionRate;
    const medical = base * this.config.medicalRate;
    const unemployment = base * this.config.unemploymentRate;
    const total = pension + medical + unemployment;

    return {
      base,
      pension,
      medical,
      unemployment,
      total,
    };
  }

  /**
   * 计算公积金缴费金额
   */
  calculateHousingFund(
    grossIncome: number,
    customBase?: number,
  ): {
    base: number;
    amount: number;
  } {
    const base = customBase || this.calculateHousingFundBase(grossIncome);
    const amount = base * this.config.housingFundRate;

    return { base, amount };
  }

  /**
   * 计算社保缴费基数
   */
  calculateSocialInsuranceBase(grossIncome: number): number {
    return Math.min(Math.max(grossIncome, this.config.socialMinBase), this.config.socialMaxBase);
  }

  /**
   * 计算公积金缴费基数
   */
  calculateHousingFundBase(grossIncome: number): number {
    return Math.min(
      Math.max(grossIncome, this.config.housingFundMinBase),
      this.config.housingFundMaxBase,
    );
  }

  /**
   * 获取缴费基数范围信息
   */
  getBaseInfo() {
    return {
      social: {
        min: this.config.socialMinBase,
        max: this.config.socialMaxBase,
        rates: {
          pension: this.config.pensionRate,
          medical: this.config.medicalRate,
          unemployment: this.config.unemploymentRate,
          total: this.config.pensionRate + this.config.medicalRate + this.config.unemploymentRate,
        },
      },
      housingFund: {
        min: this.config.housingFundMinBase,
        max: this.config.housingFundMaxBase,
        rate: this.config.housingFundRate,
      },
    };
  }
}

/**
 * 工具函数：四舍五入到2位小数
 */
export function round2(num: number): number {
  return Math.round(num * 100) / 100;
}
