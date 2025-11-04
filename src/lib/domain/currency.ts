const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  CN: "CNY",
  US: "USD",
  UK: "GBP",
  GB: "GBP",
  JP: "JPY",
  SG: "SGD",
  HK: "HKD",
  EU: "EUR",
  DE: "EUR",
  FR: "EUR",
  CA: "CAD",
  AU: "AUD",
};

const CURRENCY_LABELS: Record<string, string> = {
  CNY: "人民币",
  USD: "美元",
  EUR: "欧元",
  GBP: "英镑",
  JPY: "日元",
  SGD: "新币",
  HKD: "港币",
  CAD: "加元",
  AUD: "澳元",
};

export const SUPPORTED_CURRENCY_CODES = [
  "CNY",
  "USD",
  "EUR",
  "HKD",
  "JPY",
  "GBP",
  "SGD",
  "AUD",
  "CAD",
] as const;

export type SupportedCurrencyCode = (typeof SUPPORTED_CURRENCY_CODES)[number];

export function resolveCountryCurrency(
  country?: string | null,
  fallback: SupportedCurrencyCode = "CNY",
): SupportedCurrencyCode {
  if (!country) return fallback;
  const upper = country.toUpperCase();
  const resolved = COUNTRY_CURRENCY_MAP[upper];
  return (SUPPORTED_CURRENCY_CODES.includes(
    (resolved ?? fallback) as SupportedCurrencyCode,
  )
    ? (resolved ?? fallback)
    : fallback) as SupportedCurrencyCode;
}

export function formatCurrencyLabel(currency?: string | null): string {
  const code = (currency ?? "CNY").toUpperCase();
  const name = CURRENCY_LABELS[code];
  return name ? `${name} (${code})` : code;
}

export function getSupportedCurrencyOptions(): Array<{
  code: SupportedCurrencyCode;
  label: string;
}> {
  return SUPPORTED_CURRENCY_CODES.map((code) => ({
    code,
    label: formatCurrencyLabel(code),
  }));
}

export function ensureSupportedCurrency(
  currency?: string | null,
  fallback: SupportedCurrencyCode = "CNY",
): SupportedCurrencyCode {
  if (!currency) return fallback;
  const code = currency.toUpperCase();
  return SUPPORTED_CURRENCY_CODES.includes(code as SupportedCurrencyCode)
    ? (code as SupportedCurrencyCode)
    : fallback;
}

export function isSupportedCurrency(code?: string | null): code is SupportedCurrencyCode {
  if (!code) return false;
  return SUPPORTED_CURRENCY_CODES.includes(code.toUpperCase() as SupportedCurrencyCode);
}
