export const ALLOWED_DISPLAY_CURRENCIES = [
  "CNY",
  "USD",
  "EUR",
  "HKD",
  "JPY",
] as const;

export const DISPLAY_CURRENCY_SET = new Set(ALLOWED_DISPLAY_CURRENCIES);

