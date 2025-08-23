import { z } from "zod";

// 税率档次
export const taxBracketSchema = z.object({
  minIncome: z.number().min(0),
  maxIncome: z.number().nullable(),
  taxRate: z.number().min(0).max(1), // 0-1之间的小数
  quickDeduction: z.number().min(0),
});

export type TaxBracket = z.infer<typeof taxBracketSchema>;

// 社保公积金配置
export const socialInsuranceConfigSchema = z.object({
  // 社保相关
  socialMinBase: z.number().min(0),
  socialMaxBase: z.number().min(0),
  pensionRate: z.number().min(0).max(1),
  medicalRate: z.number().min(0).max(1),
  unemploymentRate: z.number().min(0).max(1),

  // 公积金相关
  housingFundMinBase: z.number().min(0),
  housingFundMaxBase: z.number().min(0),
  housingFundRate: z.number().min(0).max(1),
});

export type SocialInsuranceConfig = z.infer<typeof socialInsuranceConfigSchema>;

// 税务参数配置
export const taxConfigSchema = z.object({
  city: z.string(),
  effectiveFrom: z.string().transform((str) => new Date(str)),
  effectiveTo: z
    .string()
    .transform((str) => new Date(str))
    .nullable()
    .optional(),

  // 基本扣除
  monthlyBasicDeduction: z.number().default(5000),

  // 税率档次
  taxBrackets: z.array(taxBracketSchema),

  // 社保公积金配置
  socialInsurance: socialInsuranceConfigSchema,
});

export type TaxConfig = z.infer<typeof taxConfigSchema>;

// 收入计算输入
export const incomeCalculationInputSchema = z.object({
  userId: z.string(),
  year: z.number(),
  month: z.number().min(1).max(12),

  // 收入项
  gross: z.number().min(0),
  bonus: z.number().min(0).default(0),

  // 扣除项
  specialDeductions: z.number().min(0).default(0), // 专项附加扣除总额
  otherDeductions: z.number().min(0).default(0),
  charityDonations: z.number().min(0).default(0),

  // 可选的手动输入
  customSocialInsuranceBase: z.number().nullable().default(null),
  customHousingFundBase: z.number().nullable().default(null),
});

export type IncomeCalculationInput = z.infer<
  typeof incomeCalculationInputSchema
>;

// 计算结果
export interface IncomeCalculationResult {
  // 基础数据
  month: number;
  grossIncome: number;
  bonus: number;

  // 扣除项
  socialInsuranceBase: number;
  housingFundBase: number;
  socialInsurance: number;
  housingFund: number;
  specialDeductions: number;
  otherDeductions: number;
  charityDonations: number;

  // 计算结果
  taxableIncome: number;
  incomeTax: number;
  netIncome: number;

  // 使用的配置
  taxConfigVersion: string;
  effectiveTaxRate: number;

  // 适用的税率档次
  appliedTaxBracket: {
    rate: number;
    quickDeduction: number;
  };
}

// 专项附加扣除说明
export const SPECIAL_DEDUCTION_ITEMS = [
  {
    key: "childEducation",
    label: "子女教育",
    description: "每个子女每月1000元",
  },
  {
    key: "continuingEducation",
    label: "继续教育",
    description: "学历教育每月400元，职业资格教育每年3600元",
  },
  {
    key: "medicalTreatment",
    label: "大病医疗",
    description: "超过15000元部分，最高80000元",
  },
  {
    key: "housingLoanInterest",
    label: "住房贷款利息",
    description: "首套房贷利息每月1000元",
  },
  {
    key: "housingRent",
    label: "住房租金",
    description: "根据城市不同，每月1500-800元",
  },
  {
    key: "elderCare",
    label: "赡养老人",
    description: "独生子女每月2000元，非独生子女分摊每月2000元",
  },
  {
    key: "infantCare",
    label: "3岁以下婴幼儿照护",
    description: "每个婴幼儿每月1000元",
  },
] as const;

export type SpecialDeductionItem = (typeof SPECIAL_DEDUCTION_ITEMS)[number];
