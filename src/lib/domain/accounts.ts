/**
 * Account domain utilities for calculations and aggregations
 */

export interface AccountTotals {
  assets: number;
  liabilities: number;
  netWorth: number;
  archived?: number;
}

export interface AccountSummaryItem {
  accountType: string;
  valuation: number | null;
  displayValue?: number | null;
  status?: string;
}

export interface CalculateAccountTotalsOptions {
  /**
   * Whether to include archived accounts in the archived total
   * @default false
   */
  includeArchived?: boolean;
  /**
   * Whether to prefer displayValue over valuation when available
   * @default false
   */
  preferDisplayValue?: boolean;
}

/**
 * Calculate total assets, liabilities, and net worth from account summaries
 * @param items - Array of account summary items
 * @param options - Calculation options
 * @returns Calculated totals
 */
export function calculateAccountTotals(
  items: AccountSummaryItem[],
  options: CalculateAccountTotalsOptions = {},
): AccountTotals {
  const { includeArchived = false, preferDisplayValue = false } = options;

  return items.reduce(
    (acc, item) => {
      const value =
        preferDisplayValue && item.displayValue != null
          ? Number(item.displayValue)
          : Number(item.valuation ?? 0);

      const isArchived = (item.status ?? "ACTIVE") === "ARCHIVED";

      if (includeArchived && isArchived) {
        acc.archived = (acc.archived ?? 0) + value;
      }

      if (item.accountType === "LOAN") {
        acc.liabilities += value;
      } else {
        acc.assets += value;
      }

      acc.netWorth = acc.assets - acc.liabilities;
      return acc;
    },
    {
      assets: 0,
      liabilities: 0,
      netWorth: 0,
      ...(includeArchived ? { archived: 0 } : {}),
    } as AccountTotals,
  );
}
