/**
 * 货币格式化工具
 */

/**
 * 将数字格式化为货币显示格式
 * @param amount 金额
 * @param currency 货币代码，默认为CNY
 * @param decimals 小数位数，默认为2
 * @returns 格式化后的货币字符串
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = "CNY",
  decimals: number = 2
): string {
  // 处理空值
  if (amount === null || amount === undefined) {
    return "-";
  }

  // 转换为数字
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  
  // 处理NaN
  if (isNaN(num)) {
    return "-";
  }

  // 四舍五入到指定小数位
  const rounded = Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);

  // 根据货币类型格式化
  switch (currency) {
    case "CNY":
      return `¥${rounded.toFixed(decimals)}`;
    case "USD":
      return `$${rounded.toFixed(decimals)}`;
    case "EUR":
      return `€${rounded.toFixed(decimals)}`;
    default:
      return `${rounded.toFixed(decimals)} ${currency}`;
  }
}

/**
 * 将货币字符串解析为数字
 * @param currencyStr 货币字符串
 * @returns 解析后的数字
 */
export function parseCurrency(currencyStr: string): number {
  if (!currencyStr) return 0;
  
  // 移除货币符号和逗号
  const cleaned = currencyStr
    .replace(/[¥$€,]/g, "")
    .trim();
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * 将数字格式化为千分位分隔的字符串
 * @param amount 金额
 * @param decimals 小数位数
 * @returns 格式化后的字符串
 */
export function formatWithThousandsSeparator(
  amount: number | string | null | undefined,
  decimals: number = 2
): string {
  // 处理空值
  if (amount === null || amount === undefined) {
    return "-";
  }

  // 转换为数字
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  
  // 处理NaN
  if (isNaN(num)) {
    return "-";
  }

  // 四舍五入到指定小数位
  const rounded = Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
  
  // 添加千分位分隔符
  return rounded.toLocaleString("zh-CN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * 格式化为带千分位分隔符的货币显示
 * @param amount 金额
 * @param currency 货币代码
 * @param decimals 小数位数
 * @returns 格式化后的货币字符串
 */
export function formatCurrencyWithSeparator(
  amount: number | string | null | undefined,
  currency: string = "CNY",
  decimals: number = 2
): string {
  // 处理空值
  if (amount === null || amount === undefined) {
    return "-";
  }

  // 转换为数字
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  
  // 处理NaN
  if (isNaN(num)) {
    return "-";
  }

  // 四舍五入到指定小数位
  const rounded = Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
  
  // 根据货币类型格式化
  switch (currency) {
    case "CNY":
      return `¥${rounded.toLocaleString("zh-CN", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      })}`;
    case "USD":
      return `$${rounded.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      })}`;
    case "EUR":
      return `€${rounded.toLocaleString("de-DE", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      })}`;
    default:
      return `${rounded.toLocaleString("zh-CN", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      })} ${currency}`;
  }
}

// 默认导出常用的格式化方法
export default formatCurrencyWithSeparator;