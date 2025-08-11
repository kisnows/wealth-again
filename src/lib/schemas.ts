import { z } from "zod";
import { taxParamsSchema } from "./tax";

export const createTaxParamsRequest = taxParamsSchema;
export const createTaxParamsResponse = z.object({
  id: z.string(),
  key: z.string(),
});

export const incomeMonthlyRequest = z.object({
  city: z.string(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  gross: z.number().positive(),
  bonus: z.number().optional(),
});
export const incomeForecastResponse = z.object({
  results: z.array(
    z.object({
      month: z.number(),
      taxableCumulative: z.number(),
      taxDueCumulative: z.number(),
      taxThisMonth: z.number(),
      net: z.number(),
      paramsVersionKey: z.string(),
    })
  ),
});

export const accountCreateRequest = z.object({
  name: z.string(),
  baseCurrency: z.string().default("CNY"),
});
export const accountCreateResponse = z.object({ id: z.string() });

export const transactionCreateRequest = z.object({
  accountId: z.string().uuid(),
  type: z.string(),
  tradeDate: z.string(),
  instrumentSymbol: z.string().optional(),
  quantity: z.number().optional(),
  price: z.number().optional(),
  cashAmount: z.number().optional(),
  currency: z.string(),
  fee: z.number().optional(),
  tax: z.number().optional(),
  note: z.string().optional(),
});

export const valuationSnapshotRequest = z.object({
  accountId: z.string().uuid(),
  asOf: z.string(),
  totalValue: z.number(),
});

export const performanceResponse = z.object({
  performance: z.object({
    startValue: z.number(),
    endValue: z.number(),
    netContribution: z.number(),
    pnl: z.number(),
    twr: z.number(),
    xirr: z.number(),
  }),
});
