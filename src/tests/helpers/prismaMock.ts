import { vi } from "vitest";
import { prisma as prismaInstance } from "@/server/db";

const delegateMethods = [
  "findUnique",
  "findFirst",
  "findMany",
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
  "aggregate",
  "count",
  "groupBy",
] as const;

const delegates = [
  "user",
  "city",
  "cityRuleSS",
  "cityRuleHF",
  "taxConfig",
  "taxBracket",
  "account",
  "fxRate",
  "fxSnapshot",
  "txnEntry",
  "txnLine",
  "valuationSnapshot",
  "userAnnualDeduction",
  "auditLog",
  "incomeChange",
  "bonusPlan",
  "longTermCashPlan",
  "longTermCashPayout",
  "incomeRecord",
  "incomeRecalcTask",
  "displayRebaseTask",
  "equityGrant",
  "equityVest",
  "idempotencyKey",
  "cityChangeRecord",
] as const;

export const prismaMock = prismaInstance as unknown as Record<string, any>;

export function resetPrismaMock() {
  for (const name of delegates) {
    const delegate = prismaMock[name];
    if (!delegate || typeof delegate !== "object") continue;
    for (const method of delegateMethods) {
      const fn = delegate[method];
      if (typeof fn?.mockReset === "function") {
        fn.mockReset();
      }
    }
  }
  if (typeof prismaMock.$transaction?.mockReset === "function") {
    prismaMock.$transaction.mockReset();
  }
  if (typeof prismaMock.$transaction === "function") {
    prismaMock.$transaction.mockImplementation(async (fn: (client: typeof prismaMock) => any) =>
      fn(prismaMock),
    );
  }
  if (typeof prismaMock.$use?.mockReset === "function") {
    prismaMock.$use.mockReset();
  }
  if (typeof prismaMock.$connect?.mockReset === "function") {
    prismaMock.$connect.mockReset();
  }
  if (typeof prismaMock.$disconnect?.mockReset === "function") {
    prismaMock.$disconnect.mockReset();
  }
  prismaMock.account?.findMany?.mockResolvedValue([]);
  prismaMock.account?.findUnique?.mockResolvedValue(null);
  prismaMock.fxRate?.findMany?.mockResolvedValue([]);
  prismaMock.fxRate?.findFirst?.mockResolvedValue(null);
  prismaMock.fxSnapshot?.findFirst?.mockResolvedValue(null);
  prismaMock.fxSnapshot?.create?.mockImplementation(async (data: unknown) => data);
  prismaMock.incomeRecord?.findMany?.mockResolvedValue([]);
  prismaMock.incomeRecord?.findFirst?.mockResolvedValue(null);
  prismaMock.user?.findMany?.mockResolvedValue([]);
  prismaMock.user?.findUnique?.mockResolvedValue(null);
  prismaMock.cityChangeRecord?.findMany?.mockResolvedValue([]);
  prismaMock.cityChangeRecord?.findFirst?.mockResolvedValue(null);
  prismaMock.city?.findMany?.mockResolvedValue([]);
  prismaMock.city?.findUnique?.mockResolvedValue(null);
  prismaMock.taxBracket?.findMany?.mockResolvedValue([]);
}

export function stubResolved<T>(fn: ReturnType<typeof vi.fn>, value: T) {
  fn.mockResolvedValue(value);
  return fn;
}
