import { prisma } from "@/lib/prisma";

/**
 * 支持的货币类型
 */
export interface Currency {
  code: string;
  name: string;
  symbol: string;
  locale: string;
}

/**
 * 支持的货币列表
 */
export const CURRENCIES: Currency[] = [
  { code: "CNY", name: "人民币", symbol: "¥", locale: "zh-CN" },
  { code: "USD", name: "美元", symbol: "$", locale: "en-US" },
  { code: "HKD", name: "港元", symbol: "HK$", locale: "zh-HK" },
  { code: "EUR", name: "欧元", symbol: "€", locale: "de-DE" },
];

/**
 * 获取货币信息
 */
export function getCurrencyInfo(code: string): Currency {
  return CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];
}

/**
 * 统一的货币格式化函数
 * @param amount 金额
 * @param currency 货币代码
 * @param options 格式化选项
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = "CNY",
  options: {
    showSymbol?: boolean;
    precision?: number;
    locale?: string;
    compact?: boolean;
  } = {},
): string {
  const { showSymbol = true, precision = 2, locale, compact = false } = options;

  // 处理无效值
  if (amount === null || amount === undefined || amount === "") {
    return "-";
  }

  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;

  if (isNaN(numAmount) || !isFinite(numAmount)) {
    return "-";
  }

  const currencyInfo = getCurrencyInfo(currency);
  const targetLocale = locale || currencyInfo.locale;

  try {
    // 使用 Intl.NumberFormat 进行格式化
    const formatter = new Intl.NumberFormat(targetLocale, {
      style: showSymbol ? "currency" : "decimal",
      currency: showSymbol ? currency : undefined,
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
      notation: compact ? "compact" : "standard",
      compactDisplay: compact ? "short" : undefined,
    });

    return formatter.format(numAmount);
  } catch (error) {
    // 降级处理
    const sign = numAmount < 0 ? "-" : "";
    const abs = Math.abs(numAmount);
    const formatted = abs.toLocaleString(targetLocale, {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });

    return showSymbol ? `${sign}${currencyInfo.symbol}${formatted}` : `${sign}${formatted}`;
  }
}

/**
 * 格式化百分比
 * @param value 百分比值（小数形式，如 0.15 表示 15%）
 * @param precision 小数位数
 */
export function formatPercentage(
  value: number | string | null | undefined,
  precision: number = 2,
): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const numValue = typeof value === "string" ? parseFloat(value) : value;

  if (isNaN(numValue) || !isFinite(numValue)) {
    return "-";
  }

  try {
    return new Intl.NumberFormat("zh-CN", {
      style: "percent",
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    }).format(numValue);
  } catch (error) {
    return `${(numValue * 100).toFixed(precision)}%`;
  }
}

/**
 * 格式化金额变化显示
 * @param current 当前值
 * @param previous 之前值
 * @param currency 货币代码
 * @param showPercentage 是否显示百分比
 */
export function formatAmountChange(
  current: number,
  previous?: number,
  currency: string = "CNY",
  showPercentage: boolean = false,
): {
  change: number;
  changePercent: number;
  formatted: string;
  isPositive: boolean;
  isNeutral: boolean;
} {
  if (!previous || previous === 0) {
    return {
      change: 0,
      changePercent: 0,
      formatted: "-",
      isPositive: false,
      isNeutral: true,
    };
  }

  const change = current - previous;
  const changePercent = (change / previous) * 100;
  const isPositive = change > 0;
  const isNeutral = change === 0;

  const formattedChange = formatCurrency(Math.abs(change), currency);
  const formattedPercent =
    showPercentage && !isNeutral ? ` (${formatPercentage(Math.abs(changePercent) / 100, 1)})` : "";

  const icon = isNeutral ? "" : isPositive ? "↑" : "↓";
  const formatted = `${icon} ${formattedChange}${formattedPercent}`;

  return {
    change,
    changePercent,
    formatted,
    isPositive,
    isNeutral,
  };
}

/**
 * 获取汇率
 */
export async function getFxRate(
  base: string,
  quote: string,
  asOf: Date = new Date(),
): Promise<number> {
  if (base === quote) {
    return 1;
  }

  try {
    const fxRate = await prisma.fxRate.findFirst({
      where: {
        base,
        quote,
        asOf: { lte: asOf },
      },
      orderBy: { asOf: "desc" },
    });

    return fxRate ? Number(fxRate.rate) : 1;
  } catch (error) {
    console.warn(`Failed to get FX rate for ${base}/${quote}:`, error);
    return 1;
  }
}

/**
 * 货币转换
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  asOf: Date = new Date(),
): Promise<number> {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  const rate = await getFxRate(fromCurrency, toCurrency, asOf);
  return amount * rate;
}

/**
 * 验证货币代码
 */
export function isValidCurrency(code: string): boolean {
  return CURRENCIES.some((c) => c.code === code);
}

/**
 * 获取默认货币代码
 */
export function getDefaultCurrency(): string {
  return "CNY";
}
