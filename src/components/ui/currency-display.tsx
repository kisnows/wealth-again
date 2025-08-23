"use client";

import { useMemo } from "react";
import { formatCurrencyWithSeparator } from "@/lib/currency";
import { useFxRates } from "@/hooks/use-fx-rates";

interface CurrencyDisplayProps {
  amount: number | string | null;
  fromCurrency?: string;
  toCurrency?: string;
  userBaseCurrency?: string;
  showOriginal?: boolean;
  className?: string;
  precision?: number;
}

/**
 * 通用货币显示组件
 * 统一处理货币格式化和转换显示
 */
export function CurrencyDisplay({
  amount,
  fromCurrency = "CNY",
  toCurrency,
  userBaseCurrency = "CNY",
  showOriginal = false,
  className = "",
  precision = 2
}: CurrencyDisplayProps) {
  const { convert } = useFxRates(userBaseCurrency, [fromCurrency, toCurrency || userBaseCurrency]);
  
  const displayAmount = useMemo(() => {
    if (!amount || amount === 0) return "0";
    
    const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return "0";
    
    // 如果需要转换货币
    const targetCurrency = toCurrency || userBaseCurrency;
    if (fromCurrency !== targetCurrency) {
      return convert(numAmount, fromCurrency, targetCurrency);
    }
    
    return numAmount;
  }, [amount, fromCurrency, toCurrency, userBaseCurrency, convert]);

  const formattedAmount = useMemo(() => {
    return formatCurrencyWithSeparator(displayAmount);
  }, [displayAmount]);

  const currencySymbol = useMemo(() => {
    const currency = toCurrency || userBaseCurrency;
    switch (currency) {
      case "CNY": return "¥";
      case "USD": return "$";
      case "HKD": return "HK$";
      case "EUR": return "€";
      default: return currency;
    }
  }, [toCurrency, userBaseCurrency]);

  if (!amount && amount !== 0) return <span className={className}>-</span>;

  return (
    <span className={className}>
      {currencySymbol}{formattedAmount}
      {showOriginal && fromCurrency !== (toCurrency || userBaseCurrency) && (
        <span className="text-xs text-gray-500 ml-1">
          (原: {formatCurrencyWithSeparator(typeof amount === "string" ? parseFloat(amount) : amount)} {fromCurrency})
        </span>
      )}
    </span>
  );
}

/**
 * 货币输入选择组件
 */
interface CurrencySelectProps {
  value: string;
  onChange: (currency: string) => void;
  className?: string;
  disabled?: boolean;
}

export function CurrencySelect({ value, onChange, className = "", disabled = false }: CurrencySelectProps) {
  const currencies = [
    { code: "CNY", name: "人民币", symbol: "¥" },
    { code: "USD", name: "美元", symbol: "$" },
    { code: "HKD", name: "港元", symbol: "HK$" },
    { code: "EUR", name: "欧元", symbol: "€" }
  ];

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`border rounded px-3 py-2 ${className}`}
      disabled={disabled}
    >
      {currencies.map((currency) => (
        <option key={currency.code} value={currency.code}>
          {currency.name} ({currency.symbol})
        </option>
      ))}
    </select>
  );
}

/**
 * 金额变化指示器组件
 */
interface AmountChangeIndicatorProps {
  current: number;
  previous?: number;
  showPercentage?: boolean;
  className?: string;
}

export function AmountChangeIndicator({ 
  current, 
  previous, 
  showPercentage = false,
  className = "" 
}: AmountChangeIndicatorProps) {
  if (!previous) return null;
  
  const change = current - previous;
  const changePercent = previous !== 0 ? (change / previous) * 100 : 0;
  const isPositive = change > 0;
  const isNeutral = change === 0;
  
  const colorClass = isNeutral ? "text-gray-500" : isPositive ? "text-green-600" : "text-red-600";
  const icon = isNeutral ? "=" : isPositive ? "↑" : "↓";
  
  return (
    <span className={`text-sm ${colorClass} ${className}`}>
      {icon} {formatCurrencyWithSeparator(Math.abs(change))}
      {showPercentage && !isNeutral && ` (${changePercent.toFixed(1)}%)`}
    </span>
  );
}