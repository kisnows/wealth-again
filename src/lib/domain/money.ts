const DEFAULT_LOCALE = "zh-CN";

export function formatMoney(
  value: number,
  currency = "CNY",
  locale: string = DEFAULT_LOCALE,
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}
