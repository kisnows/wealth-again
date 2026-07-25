export type AccentKey =
  | "primary"
  | "success"
  | "accent"
  | "warning"
  | "info"
  | "danger"
  | "neutral";

type AccentToken = {
  /**
   * Tailwind utility classes used for gradient strips or emphasis backgrounds.
   */
  gradient: string;
  /**
   * Soft surface style (background + text) used for badges or icon wrappers.
   */
  surface: string;
  /**
   * Text emphasis class applied to headline numbers.
   */
  emphasis: string;
  /**
   * Plain text class used when only color (no background) is required.
   */
  text: string;
  /**
   * Hex color applied to chart series.
   */
  chart: string;
};

export const accentTokens: Record<AccentKey, AccentToken> = {
  primary: {
    gradient: "from-indigo-500/80 via-indigo-500/60 to-indigo-500/30",
    surface: "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/20 dark:text-indigo-200",
    emphasis: "text-indigo-600 dark:text-indigo-200",
    text: "text-indigo-500 dark:text-indigo-200",
    chart: "var(--semantic-networth)",
  },
  success: {
    gradient: "from-emerald-500/80 via-emerald-500/50 to-emerald-500/25",
    surface: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-200",
    emphasis: "text-emerald-600 dark:text-emerald-200",
    text: "text-emerald-500 dark:text-emerald-200",
    chart: "var(--semantic-income-net)",
  },
  accent: {
    gradient: "from-violet-500/80 via-violet-500/50 to-violet-500/25",
    surface: "bg-violet-500/10 text-violet-600 dark:bg-violet-400/20 dark:text-violet-200",
    emphasis: "text-violet-600 dark:text-violet-200",
    text: "text-violet-500 dark:text-violet-200",
    chart: "var(--semantic-income-total)",
  },
  warning: {
    gradient: "from-amber-500/80 via-amber-500/50 to-amber-500/25",
    surface: "bg-amber-500/10 text-amber-600 dark:bg-amber-400/25 dark:text-amber-200",
    emphasis: "text-amber-600 dark:text-amber-200",
    text: "text-amber-500 dark:text-amber-200",
    chart: "var(--semantic-income-deduction)",
  },
  info: {
    gradient: "from-sky-500/80 via-sky-500/50 to-sky-500/25",
    surface: "bg-sky-500/10 text-sky-600 dark:bg-cyan-400/20 dark:text-cyan-100",
    emphasis: "text-sky-600 dark:text-cyan-100",
    text: "text-sky-500 dark:text-cyan-100",
    chart: "var(--semantic-income-tax-rate)",
  },
  danger: {
    gradient: "from-rose-500/80 via-rose-500/50 to-rose-500/25",
    surface: "bg-rose-500/10 text-rose-600 dark:bg-rose-400/20 dark:text-rose-200",
    emphasis: "text-rose-600 dark:text-rose-200",
    text: "text-rose-500 dark:text-rose-200",
    chart: "var(--semantic-income-tax)",
  },
  neutral: {
    gradient: "from-slate-500/60 via-slate-500/40 to-slate-500/20",
    surface: "bg-slate-500/10 text-slate-600 dark:bg-slate-400/25 dark:text-slate-200",
    emphasis: "text-slate-600 dark:text-slate-200",
    text: "text-slate-500 dark:text-slate-200",
    chart: "var(--semantic-income-housing)",
  },
} as const;

export const chartTokens = {
  netWorth: "var(--semantic-networth)",
  allocation: [
    "var(--semantic-networth)",
    "var(--semantic-income-net)",
    "var(--semantic-income-total)",
    "var(--semantic-income-tax-rate)",
    "var(--semantic-income-deduction)",
    "var(--semantic-income-tax)",
    "var(--semantic-income-housing)",
  ],
  incomeSeries: {
    gross: "var(--semantic-income-total)",
    bonus: "var(--semantic-income-bonus)",
    ltcIncome: "var(--semantic-income-ltc)",
    equityIncome: "var(--semantic-income-equity)",
    socialInsurance: "var(--semantic-income-social)",
    housingFund: "var(--semantic-income-housing)",
    incomeTax: "var(--semantic-income-tax)",
  },
} as const;

export const semanticTextTokens = {
  positive: "text-[color:var(--semantic-positive-text)]",
  negative: "text-[color:var(--semantic-negative-text)]",
  neutral: "text-[color:var(--semantic-neutral-text)]",
} as const;

export const semanticAccents = {
  netWorth: "primary",
  income: {
    total: "accent",
    net: "success",
    deductions: "warning",
    taxRate: "info",
  },
} as const satisfies {
  netWorth: AccentKey;
  income: {
    total: AccentKey;
    net: AccentKey;
    deductions: AccentKey;
    taxRate: AccentKey;
  };
};
