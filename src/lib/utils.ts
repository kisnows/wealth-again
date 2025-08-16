import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 合并CSS类名
 * @param {...ClassValue[]} inputs - CSS类名数组
 * @returns {string} 合并后的CSS类名
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 格式化货币金额
 * @param {number} amount - 金额
 * @param {string} currency - 货币代码，默认为"CNY"
 * @param {string} locale - 本地化代码，默认为"zh-CN"
 * @returns {string} 格式化后的货币字符串
 */
export function formatCurrency(
  amount: number,
  currency: string = "CNY",
  locale: string = "zh-CN"
): string {
  if (Number.isNaN(amount) || !Number.isFinite(amount)) return "-";
  try {
    const formatted = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return formatted;
  } catch {
    const sign = amount < 0 ? "-" : "";
    const n = Math.abs(amount).toFixed(2);
    const withThousands = n.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const symbol = currency === "CNY" ? "¥" : "";
    return `${sign}${symbol}${withThousands}`;
  }
}

/**
 * 格式化百分比
 * @param {number} value - 百分比值（小数形式）
 * @param {number} fractionDigits - 小数位数，默认为2
 * @returns {string} 格式化后的百分比字符串
 */
export function formatPercentage(value: number, fractionDigits = 2): string {
  if (Number.isNaN(value) || !Number.isFinite(value)) return "-";
  const pct = (value * 100).toFixed(fractionDigits);
  return `${pct}%`;
}
