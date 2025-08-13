// 基础类型定义
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt?: string;
}

// 用户相关类型
export interface User extends BaseEntity {
  email: string;
  name?: string;
  isActive: boolean;
  lastLoginAt?: string;
}

export interface UserPreference extends BaseEntity {
  userId: string;
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  currency: string;
  dateFormat: string;
  numberFormat: string;
  pageSize: number;
  dashboardConfig?: string;
}

export interface Session extends BaseEntity {
  userId: string;
  token: string;
  expiresAt: string;
  ipAddress?: string;
  userAgent?: string;
}

// 投资相关类型
export interface Account extends BaseEntity {
  userId: string;
  name: string;
  baseCurrency: string;
  _count?: {
    transactions: number;
    snapshots: number;
  };
}

export interface Transaction extends BaseEntity {
  accountId: string;
  type: TransactionType;
  tradeDate: string;
  instrumentId?: string;
  quantity?: string;
  price?: string;
  cashAmount: string;
  currency: string;
  fee?: string;
  tax?: string;
  note?: string;
  status?: TransactionStatus;
  account?: Pick<Account, 'name'>;
  instrument?: Pick<Instrument, 'symbol' | 'type'>;
}

export type TransactionType = 'BUY' | 'SELL' | 'DEPOSIT' | 'WITHDRAW' | 'DIVIDEND' | 'FEE';
export type TransactionStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

export interface Instrument extends BaseEntity {
  symbol: string;
  market?: string;
  currency: string;
  type: InstrumentType;
}

export type InstrumentType = 'EQUITY' | 'FUND' | 'BOND' | 'CRYPTO' | 'OTHER';

export interface ValuationSnapshot extends BaseEntity {
  accountId: string;
  asOf: string;
  totalValue: string;
  breakdown: string;
}

export interface Performance {
  startValue: number;
  endValue: number;
  netContribution: number;
  pnl: number;
  twr: number;
  xirr: number;
  startDate: string;
  endDate: string;
}

// 收入相关类型
export interface IncomeRecord extends BaseEntity {
  userId: string;
  city: string;
  year: number;
  month: number;
  gross: string;
  bonus?: string;
  socialInsuranceBase?: string;
  housingFundBase?: string;
  socialInsurance?: string;
  housingFund?: string;
  specialDeductions?: string;
  otherDeductions?: string;
  charityDonations?: string;
  taxableIncome?: string;
  incomeTax?: string;
  netIncome?: string;
  overrides?: string;
}

export interface IncomeChange extends BaseEntity {
  userId: string;
  city: string;
  grossMonthly: string;
  effectiveFrom: string;
}

export interface BonusPlan extends BaseEntity {
  userId: string;
  city: string;
  amount: string;
  effectiveDate: string;
}

export interface IncomeForecast {
  month: number;
  ym?: string;
  grossThisMonth: number;
  net: number;
  taxableIncome?: number;
  incomeTax?: number;
  markers?: {
    salaryChange?: boolean;
    bonusPaid?: boolean;
    taxChange?: boolean;
  };
}

export interface IncomeSummary {
  totalSalary: number;
  totalBonus: number;
  totalGross: number;
  totalNet: number;
  totalTax: number;
}

// 税务相关类型
export interface TaxBracket extends BaseEntity {
  city: string;
  minIncome: string;
  maxIncome?: string;
  taxRate: string;
  quickDeduction: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface SocialInsuranceConfig extends BaseEntity {
  city: string;
  socialMinBase: string;
  socialMaxBase: string;
  pensionRate: string;
  medicalRate: string;
  unemploymentRate: string;
  housingFundMinBase: string;
  housingFundMaxBase: string;
  housingFundRate: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

// 通知相关类型
export interface Notification extends BaseEntity {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  data?: string;
  expiresAt?: string;
}

export type NotificationType = 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';

// 审计日志类型
export interface AuditLog extends BaseEntity {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldValues?: string;
  newValues?: string;
  ipAddress?: string;
  userAgent?: string;
}

// API 相关类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: PaginationInfo;
  meta?: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// 表单相关类型
export interface FormFieldError {
  message: string;
  type: string;
}

export interface FormState<T> {
  data: T;
  errors: Partial<Record<keyof T, FormFieldError>>;
  loading: boolean;
  dirty: boolean;
  valid: boolean;
}

// 图表数据类型
export interface ChartDataPoint {
  x: string | number;
  y: number;
  label?: string;
  color?: string;
}

export interface TimeSeriesData {
  date: string;
  value: number;
  category?: string;
}

export interface PerformanceChartData {
  date: string;
  value: number;
  contribution?: number;
  benchmark?: number;
}

// 系统配置类型
export interface SystemSetting extends BaseEntity {
  key: string;
  value: string;
  description?: string;
  category: string;
  isPublic: boolean;
}

export interface Config extends BaseEntity {
  key: string;
  value: string;
  effectiveFrom: string;
  effectiveTo?: string;
  category?: string;
  isActive?: boolean;
  priority?: number;
}

// 备份相关类型
export interface BackupRecord extends BaseEntity {
  userId?: string;
  fileName: string;
  filePath: string;
  fileSize: bigint;
  type: 'FULL' | 'INCREMENTAL';
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  errorMessage?: string;
  completedAt?: string;
}

// 实用工具类型
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

// 响应包装器类型
export type ApiSuccess<T> = {
  success: true;
  data: T;
} & Omit<ApiResponse<T>, 'success' | 'data' | 'error'>;

export type ApiError = {
  success: false;
  error: NonNullable<ApiResponse['error']>;
} & Omit<ApiResponse, 'success' | 'data' | 'error'>;

// 事件类型
export interface AppEvent {
  type: string;
  payload?: any;
  timestamp: number;
}

// 主题相关类型
export type Theme = 'light' | 'dark' | 'system';

export interface ThemeConfig {
  primary: string;
  secondary: string;
  background: string;
  foreground: string;
  muted: string;
  accent: string;
  destructive: string;
  border: string;
  input: string;
  ring: string;
}