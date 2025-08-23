import { z } from "zod";
import type { NotificationType, TransactionStatus, TransactionType } from "@/types";

// 基础验证模式
export const uuidSchema = z.string().uuid();
export const emailSchema = z.string().email();
export const dateSchema = z.string().datetime();
export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const decimalStringSchema = z.string().regex(/^\d+(\.\d{1,2})?$/);
export const positiveNumberSchema = z.number().positive();
export const nonNegativeNumberSchema = z.number().nonnegative();

// 分页参数验证
export const paginationParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// 用户相关验证模式
export const registerUserSchema = z.object({
  name: z.string().min(2, "姓名至少需要2个字符"),
  email: emailSchema,
  password: z.string().min(6, "密码至少需要6个字符"),
});

export const loginUserSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "密码不能为空"),
});

export const updateUserProfileSchema = z.object({
  name: z.string().min(2).optional(),
  email: emailSchema.optional(),
});

export const userPreferenceSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).default("system"),
  language: z.string().default("zh-CN"),
  timezone: z.string().default("Asia/Shanghai"),
  currency: z.string().default("CNY"),
  dateFormat: z.string().default("YYYY-MM-DD"),
  numberFormat: z.string().default("en-US"),
  pageSize: z.number().int().min(1).max(100).default(20),
  dashboardConfig: z.string().optional(),
});

// 投资相关验证模式
export const createAccountSchema = z.object({
  name: z.string().min(1, "账户名称不能为空"),
  baseCurrency: z.string().default("CNY"),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1, "账户名称不能为空").optional(),
  baseCurrency: z.string().optional(),
});

export const transactionTypeSchema = z.enum(["DEPOSIT", "WITHDRAW", "TRANSFER_IN", "TRANSFER_OUT"]);
export const transactionStatusSchema = z.enum(["PENDING", "CONFIRMED", "CANCELLED"]);

export const createTransactionSchema = z.object({
  accountId: uuidSchema,
  type: transactionTypeSchema,
  tradeDate: dateStringSchema,
  cashAmount: z.number(),
  currency: z.string().default("CNY"),
  note: z.string().optional(),
});

export const updateTransactionSchema = createTransactionSchema.partial().omit({ accountId: true });

export const valuationSnapshotSchema = z.object({
  accountId: uuidSchema,
  asOf: dateStringSchema,
  totalValue: positiveNumberSchema,
  breakdown: z.record(z.string(), z.number()).optional(),
});

// 收入相关验证模式
export const createIncomeRecordSchema = z.object({
  city: z.string().min(1, "城市不能为空"),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  gross: positiveNumberSchema,
  bonus: nonNegativeNumberSchema.optional(),
  socialInsuranceBase: positiveNumberSchema.optional(),
  housingFundBase: positiveNumberSchema.optional(),
  specialDeductions: nonNegativeNumberSchema.optional(),
  otherDeductions: nonNegativeNumberSchema.optional(),
  charityDonations: nonNegativeNumberSchema.optional(),
  overrides: z.record(z.string(), z.any()).optional(),
  effectiveDate: dateStringSchema.optional(),
});

export const updateIncomeRecordSchema = createIncomeRecordSchema.partial();

export const createIncomeChangeSchema = z.object({
  city: z.string().min(1, "城市不能为空"),
  grossMonthly: positiveNumberSchema,
  effectiveFrom: dateStringSchema,
});

export const createBonusPlanSchema = z.object({
  city: z.string().min(1, "城市不能为空"),
  amount: positiveNumberSchema,
  effectiveDate: dateStringSchema,
});

export const incomeForecastParamsSchema = z.object({
  city: z.string().optional(),
  year: z.coerce.number().int().optional(),
  start: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(), // YYYY-MM format
  end: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(), // YYYY-MM format
  months: z.coerce.number().int().min(1).max(60).optional(),
});

// 税务相关验证模式
export const createTaxBracketSchema = z.object({
  city: z.string().min(1, "城市不能为空"),
  minIncome: nonNegativeNumberSchema,
  maxIncome: positiveNumberSchema.optional(),
  taxRate: z.number().min(0).max(1), // 税率应该是0-1之间的小数
  quickDeduction: nonNegativeNumberSchema,
  effectiveFrom: dateStringSchema,
  effectiveTo: dateStringSchema.optional(),
});

export const createSocialInsuranceConfigSchema = z.object({
  city: z.string().min(1, "城市不能为空"),
  socialMinBase: positiveNumberSchema,
  socialMaxBase: positiveNumberSchema,
  pensionRate: z.number().min(0).max(1),
  medicalRate: z.number().min(0).max(1),
  unemploymentRate: z.number().min(0).max(1),
  housingFundMinBase: positiveNumberSchema,
  housingFundMaxBase: positiveNumberSchema,
  housingFundRate: z.number().min(0).max(1),
  effectiveFrom: dateStringSchema,
  effectiveTo: dateStringSchema.optional(),
});

// 通知相关验证模式
export const notificationTypeSchema = z.enum(["INFO", "WARNING", "ERROR", "SUCCESS"]);

export const createNotificationSchema = z.object({
  type: notificationTypeSchema,
  title: z.string().min(1, "标题不能为空"),
  message: z.string().min(1, "内容不能为空"),
  data: z.string().optional(),
  expiresAt: dateSchema.optional(),
});

// 系统配置验证模式
export const createSystemSettingSchema = z.object({
  key: z.string().min(1, "配置键不能为空"),
  value: z.string(),
  description: z.string().optional(),
  category: z.string().default("general"),
  isPublic: z.boolean().default(false),
});

export const createConfigSchema = z.object({
  key: z.string().min(1, "配置键不能为空"),
  value: z.string(),
  effectiveFrom: dateSchema,
  effectiveTo: dateSchema.optional(),
  category: z.string().default("general"),
  priority: z.number().int().default(0),
});

// 备份相关验证模式
export const createBackupSchema = z.object({
  type: z.enum(["FULL", "INCREMENTAL"]).default("FULL"),
});

// 查询参数验证模式
export const accountQuerySchema = z.object({
  ...paginationParamsSchema.shape,
  currency: z.string().optional(),
});

export const transactionQuerySchema = z.object({
  ...paginationParamsSchema.shape,
  accountId: uuidSchema.optional(),
  type: transactionTypeSchema.optional(),
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
});

export const incomeRecordQuerySchema = z.object({
  ...paginationParamsSchema.shape,
  year: z.coerce.number().int().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  city: z.string().optional(),
});

// API 响应验证模式
export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.any().optional(),
});

export const paginationInfoSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

export const apiResponseSchema = <T>(dataSchema: z.ZodSchema<T>) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: apiErrorSchema.optional(),
    pagination: paginationInfoSchema.optional(),
    meta: z
      .object({
        timestamp: z.string(),
        requestId: z.string(),
        version: z.string(),
      })
      .optional(),
  });

// 导出类型推断
export type RegisterUserInput = z.infer<typeof registerUserSchema>;
export type LoginUserInput = z.infer<typeof loginUserSchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type CreateIncomeRecordInput = z.infer<typeof createIncomeRecordSchema>;
export type CreateBonusPlanInput = z.infer<typeof createBonusPlanSchema>;
export type PaginationParams = z.infer<typeof paginationParamsSchema>;
export type IncomeForecastParams = z.infer<typeof incomeForecastParamsSchema>;
export type TransactionQueryParams = z.infer<typeof transactionQuerySchema>;
export type IncomeRecordQueryParams = z.infer<typeof incomeRecordQuerySchema>;
