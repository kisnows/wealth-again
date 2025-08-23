import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 重新导出货币相关函数，保持向后兼容
export {
  CURRENCIES,
  convertCurrency,
  formatCurrency,
  formatPercentage,
  getCurrencyInfo,
  getFxRate,
} from "@/lib/currency-utils";
