import { PrismaClient } from "@prisma/client";
import { TaxBracket, SocialInsuranceConfig } from "./types";

export class TaxConfigRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * 获取指定城市和时间的税率档次
   */
  async getTaxBrackets(
    city: string,
    date: Date = new Date()
  ): Promise<TaxBracket[]> {
    const brackets = await this.prisma.taxBracket.findMany({
      where: {
        city,
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      },
      orderBy: {
        minIncome: "asc",
      },
    });

    return brackets.map((bracket) => ({
      minIncome: Number(bracket.minIncome),
      maxIncome: bracket.maxIncome ? Number(bracket.maxIncome) : null,
      taxRate: Number(bracket.taxRate),
      quickDeduction: Number(bracket.quickDeduction),
    }));
  }

  /**
   * 获取社保公积金配置
   */
  async getSocialInsuranceConfig(
    city: string,
    date: Date = new Date()
  ): Promise<SocialInsuranceConfig | null> {
    const config = await this.prisma.socialInsuranceConfig.findFirst({
      where: {
        city,
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      },
      orderBy: {
        effectiveFrom: "desc",
      },
    });

    if (!config) return null;

    return {
      socialMinBase: Number(config.socialMinBase),
      socialMaxBase: Number(config.socialMaxBase),
      pensionRate: Number(config.pensionRate),
      medicalRate: Number(config.medicalRate),
      unemploymentRate: Number(config.unemploymentRate),
      housingFundMinBase: Number(config.housingFundMinBase),
      housingFundMaxBase: Number(config.housingFundMaxBase),
      housingFundRate: Number(config.housingFundRate),
    };
  }

  /**
   * 保存税率档次配置
   */
  async saveTaxBrackets(
    city: string,
    brackets: TaxBracket[],
    effectiveFrom: Date,
    effectiveTo?: Date
  ) {
    // 先结束之前的配置
    await this.prisma.taxBracket.updateMany({
      where: {
        city,
        effectiveTo: null,
      },
      data: {
        effectiveTo: effectiveFrom,
      },
    });

    // 创建新的配置
    const data = brackets.map((bracket) => ({
      city,
      minIncome: bracket.minIncome,
      maxIncome: bracket.maxIncome,
      taxRate: bracket.taxRate,
      quickDeduction: bracket.quickDeduction,
      effectiveFrom,
      effectiveTo,
    }));

    return this.prisma.taxBracket.createMany({
      data,
    });
  }

  /**
   * 保存社保公积金配置
   */
  async saveSocialInsuranceConfig(
    city: string,
    config: SocialInsuranceConfig,
    effectiveFrom: Date,
    effectiveTo?: Date
  ) {
    // 先结束之前的配置
    await this.prisma.socialInsuranceConfig.updateMany({
      where: {
        city,
        effectiveTo: null,
      },
      data: {
        effectiveTo: effectiveFrom,
      },
    });

    // 创建新的配置
    return this.prisma.socialInsuranceConfig.create({
      data: {
        city,
        socialMinBase: config.socialMinBase,
        socialMaxBase: config.socialMaxBase,
        pensionRate: config.pensionRate,
        medicalRate: config.medicalRate,
        unemploymentRate: config.unemploymentRate,
        housingFundMinBase: config.housingFundMinBase,
        housingFundMaxBase: config.housingFundMaxBase,
        housingFundRate: config.housingFundRate,
        effectiveFrom,
        effectiveTo,
      },
    });
  }

  /**
   * 获取用户收入记录
   */
  async getIncomeRecord(userId: string, year: number, month: number) {
    return this.prisma.incomeRecord.findUnique({
      where: {
        userId_year_month: {
          userId,
          year,
          month,
        },
      },
    });
  }

  /**
   * 保存或更新收入记录
   */
  async saveIncomeRecord(data: {
    userId: string;
    year: number;
    month: number;
    city: string;
    gross: number;
    bonus?: number;
    socialInsuranceBase?: number;
    housingFundBase?: number;
    socialInsurance?: number;
    housingFund?: number;
    specialDeductions?: number;
    otherDeductions?: number;
    charityDonations?: number;
    taxableIncome?: number;
    incomeTax?: number;
    netIncome?: number;
  }) {
    return this.prisma.incomeRecord.upsert({
      where: {
        userId_year_month: {
          userId: data.userId,
          year: data.year,
          month: data.month,
        },
      },
      update: {
        city: data.city,
        gross: data.gross,
        bonus: data.bonus || 0,
        socialInsuranceBase: data.socialInsuranceBase,
        housingFundBase: data.housingFundBase,
        socialInsurance: data.socialInsurance || 0,
        housingFund: data.housingFund || 0,
        specialDeductions: data.specialDeductions || 0,
        otherDeductions: data.otherDeductions || 0,
        charityDonations: data.charityDonations || 0,
        taxableIncome: data.taxableIncome,
        incomeTax: data.incomeTax,
        netIncome: data.netIncome,
      },
      create: {
        userId: data.userId,
        year: data.year,
        month: data.month,
        city: data.city,
        gross: data.gross,
        bonus: data.bonus || 0,
        socialInsuranceBase: data.socialInsuranceBase,
        housingFundBase: data.housingFundBase,
        socialInsurance: data.socialInsurance || 0,
        housingFund: data.housingFund || 0,
        specialDeductions: data.specialDeductions || 0,
        otherDeductions: data.otherDeductions || 0,
        charityDonations: data.charityDonations || 0,
        taxableIncome: data.taxableIncome,
        incomeTax: data.incomeTax,
        netIncome: data.netIncome,
      },
    });
  }

  /**
   * 获取年度收入记录
   */
  async getAnnualIncomeRecords(userId: string, year: number) {
    return this.prisma.incomeRecord.findMany({
      where: {
        userId,
        year,
      },
      orderBy: {
        month: "asc",
      },
    });
  }

  /**
   * 获取配置的历史版本
   */
  async getTaxConfigHistory(city: string, limit: number = 10) {
    const [brackets, socialConfigs] = await Promise.all([
      this.prisma.taxBracket.findMany({
        where: { city },
        orderBy: { effectiveFrom: "desc" },
        take: limit,
        distinct: ["effectiveFrom"],
      }),
      this.prisma.socialInsuranceConfig.findMany({
        where: { city },
        orderBy: { effectiveFrom: "desc" },
        take: limit,
      }),
    ]);

    return {
      brackets,
      socialConfigs,
    };
  }
}
