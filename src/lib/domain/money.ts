const DEFAULT_LOCALE = "zh-CN";

export function formatMoney(
  value: number | null | undefined,
  currency: string | null | undefined = "CNY",
  locale: string = DEFAULT_LOCALE,
): string {
  if (!Number.isFinite(value)) return "-";
  const currencyCode = currency ?? "CNY";
  const numValue = value as number; // Safe after isFinite check
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(numValue);
  } catch {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numValue);
  }
}
