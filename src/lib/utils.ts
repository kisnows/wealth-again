import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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

export function formatPercentage(value: number, fractionDigits = 2): string {
  if (Number.isNaN(value) || !Number.isFinite(value)) return "-";
  const pct = (value * 100).toFixed(fractionDigits);
  return `${pct}%`;
}
