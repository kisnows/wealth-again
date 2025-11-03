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

export function resolveCountryCurrency(
  country?: string | null,
  fallback = "CNY",
): string {
  if (!country) return fallback;
  const upper = country.toUpperCase();
  return COUNTRY_CURRENCY_MAP[upper] ?? fallback;
}

export function formatCurrencyLabel(currency?: string | null): string {
  const code = (currency ?? "CNY").toUpperCase();
  const name = CURRENCY_LABELS[code];
  return name ? `${name} (${code})` : code;
}
