"use client";

import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFxRates } from "@/hooks/use-fx-rates";
import {
  CURRENCIES,
  type Currency,
  formatAmountChange,
  formatCurrency,
  formatPercentage,
  getCurrencyInfo,
} from "@/lib/currency-utils";
import { cn } from "@/lib/utils";

// ==================== Currency Display Component ====================

interface CurrencyDisplayProps {
  /** 金额数值 */
  amount: number | string | null | undefined;
  /** 源货币代码 */
  fromCurrency?: string;
  /** 目标货币代码 */
  toCurrency?: string;
  /** 用户基准货币 */
  userBaseCurrency?: string;
  /** 是否显示原始金额 */
  showOriginal?: boolean;
  /** 小数位数 */
  precision?: number;
  /** 是否紧凑显示 */
  compact?: boolean;
  /** 是否显示货币符号 */
  showSymbol?: boolean;
  /** 自定义样式 */
  className?: string;
  /** 测试标识 */
  "data-testid"?: string;
}

/**
 * 统一的货币显示组件
 */
export function CurrencyDisplay({
  amount,
  fromCurrency = "CNY",
  toCurrency,
  userBaseCurrency = "CNY",
  showOriginal = false,
  precision = 2,
  compact = false,
  showSymbol = true,
  className,
  "data-testid": testId,
}: CurrencyDisplayProps) {
  const { convert } = useFxRates(userBaseCurrency, [fromCurrency, toCurrency || userBaseCurrency]);

  const { displayAmount, displayCurrency, originalFormatted } = useMemo(() => {
    if (!amount || amount === 0) {
      return {
        displayAmount: 0,
        displayCurrency: toCurrency || userBaseCurrency,
        originalFormatted: null,
      };
    }

    const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) {
      return {
        displayAmount: 0,
        displayCurrency: toCurrency || userBaseCurrency,
        originalFormatted: null,
      };
    }

    const targetCurrency = toCurrency || userBaseCurrency;
    let convertedAmount = numAmount;

    // 货币转换
    if (fromCurrency !== targetCurrency) {
      convertedAmount = convert(numAmount, fromCurrency, targetCurrency);
    }

    // 原始金额格式化
    const originalFormatted =
      showOriginal && fromCurrency !== targetCurrency
        ? formatCurrency(numAmount, fromCurrency, { precision, compact, showSymbol })
        : null;

    return {
      displayAmount: convertedAmount,
      displayCurrency: targetCurrency,
      originalFormatted,
    };
  }, [
    amount,
    fromCurrency,
    toCurrency,
    userBaseCurrency,
    convert,
    showOriginal,
    precision,
    compact,
    showSymbol,
  ]);

  const formattedAmount = formatCurrency(displayAmount, displayCurrency, {
    precision,
    compact,
    showSymbol,
  });

  if (!amount && amount !== 0) {
    return (
      <span className={cn("text-muted-foreground", className)} data-testid={testId}>
        -
      </span>
    );
  }

  return (
    <span className={cn("font-medium", className)} data-testid={testId}>
      {formattedAmount}
      {originalFormatted && (
        <span className="text-xs text-muted-foreground ml-1">(原: {originalFormatted})</span>
      )}
    </span>
  );
}

// ==================== Currency Select Component ====================

interface CurrencySelectProps {
  /** 当前选中的货币代码 */
  value: string;
  /** 货币变更回调 */
  onChange: (currency: string) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 可选货币列表，默认为全部支持的货币 */
  currencies?: Currency[];
  /** 占位符文本 */
  placeholder?: string;
  /** 自定义样式 */
  className?: string;
  /** 测试标识 */
  "data-testid"?: string;
}

/**
 * 货币选择组件
 */
export function CurrencySelect({
  value,
  onChange,
  disabled = false,
  currencies = CURRENCIES,
  placeholder = "选择货币",
  className,
  "data-testid": testId,
}: CurrencySelectProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={cn("w-full", className)} data-testid={testId}>
        <SelectValue placeholder={placeholder}>
          {value &&
            (() => {
              const currency = getCurrencyInfo(value);
              return `${currency.name} (${currency.symbol})`;
            })()}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {currencies.map((currency) => (
          <SelectItem
            key={currency.code}
            value={currency.code}
            data-testid={`${testId}-option-${currency.code}`}
          >
            <div className="flex items-center gap-2">
              <span className="font-medium">{currency.symbol}</span>
              <span>{currency.name}</span>
              <span className="text-muted-foreground text-sm">({currency.code})</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ==================== Percentage Display Component ====================

interface PercentageDisplayProps {
  /** 百分比值（小数形式） */
  value: number | string | null | undefined;
  /** 小数位数 */
  precision?: number;
  /** 自定义样式 */
  className?: string;
  /** 测试标识 */
  "data-testid"?: string;
}

/**
 * 百分比显示组件
 */
export function PercentageDisplay({
  value,
  precision = 2,
  className,
  "data-testid": testId,
}: PercentageDisplayProps) {
  const formatted = formatPercentage(value, precision);

  if (formatted === "-") {
    return (
      <span className={cn("text-muted-foreground", className)} data-testid={testId}>
        -
      </span>
    );
  }

  return (
    <span className={cn("font-medium", className)} data-testid={testId}>
      {formatted}
    </span>
  );
}

// ==================== Amount Change Indicator Component ====================

interface AmountChangeIndicatorProps {
  /** 当前值 */
  current: number;
  /** 之前值 */
  previous?: number;
  /** 货币代码 */
  currency?: string;
  /** 是否显示百分比 */
  showPercentage?: boolean;
  /** 自定义样式 */
  className?: string;
  /** 测试标识 */
  "data-testid"?: string;
}

/**
 * 金额变化指示器组件
 */
export function AmountChangeIndicator({
  current,
  previous,
  currency = "CNY",
  showPercentage = false,
  className,
  "data-testid": testId,
}: AmountChangeIndicatorProps) {
  const changeInfo = formatAmountChange(current, previous, currency, showPercentage);

  if (!previous || changeInfo.isNeutral) {
    return (
      <span className={cn("text-muted-foreground text-sm", className)} data-testid={testId}>
        -
      </span>
    );
  }

  const colorClass = changeInfo.isPositive
    ? "text-green-600 dark:text-green-400"
    : "text-red-600 dark:text-red-400";

  return (
    <span className={cn("text-sm font-medium", colorClass, className)} data-testid={testId}>
      {changeInfo.formatted}
    </span>
  );
}

// ==================== Currency Input Component ====================

interface CurrencyInputProps {
  /** 当前值 */
  value: string;
  /** 值变更回调 */
  onChange: (value: string) => void;
  /** 当前选中的货币 */
  currency: string;
  /** 货币变更回调 */
  onCurrencyChange: (currency: string) => void;
  /** 占位符 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义样式 */
  className?: string;
  /** 测试标识 */
  "data-testid"?: string;
}

/**
 * 货币输入组件
 */
export function CurrencyInput({
  value,
  onChange,
  currency,
  onCurrencyChange,
  placeholder = "请输入金额",
  disabled = false,
  className,
  "data-testid": testId,
}: CurrencyInputProps) {
  const currencyInfo = getCurrencyInfo(currency);

  return (
    <div className={cn("flex gap-2", className)} data-testid={testId}>
      <div className="flex-1 relative">
        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none">
          {currencyInfo.symbol}
        </span>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "w-full pl-8 pr-3 py-2 border border-input bg-background rounded-md",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
          data-testid={`${testId}-amount`}
        />
      </div>
      <CurrencySelect
        value={currency}
        onChange={onCurrencyChange}
        disabled={disabled}
        className="w-32"
        data-testid={`${testId}-currency`}
      />
    </div>
  );
}
