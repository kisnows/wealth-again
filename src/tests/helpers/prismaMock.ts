import type { IncomeRecalcTask } from "@prisma/client";
import { vi } from "vitest";
import { prisma as prismaInstance } from "@/server/db";
import { clearTaxContextCache } from "@/server/services/income-tax/tax";

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
  "eventOutbox",
  "displayRebaseTask",
  "equityGrant",
  "equityVest",
  "idempotencyKey",
  "cityChangeRecord",
  "reportDataset",
] as const;

export const prismaMock = prismaInstance as unknown as Record<string, any>;

function buildIncomeRecalcTask(overrides: Partial<IncomeRecalcTask> = {}): IncomeRecalcTask {
  const now = new Date();
  return {
    id: "task-mock",
    userId: null,
    taxYear: 2025,
    startMonth: 1,
    endMonth: 12,
    cityId: null,
    status: "PENDING",
    scheduledFor: now,
    attempts: 0,
    lastError: null,
    triggeredBy: null,
    createdAt: now,
    updatedAt: now,
    processedAt: null,
    ...overrides,
  } satisfies IncomeRecalcTask;
}

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
  prismaMock.fxSnapshot?.create?.mockImplementation(
    async ({ data }: { data: any }) => ({
      id: data?.id ?? "snap-mock",
      baseCurrency: data?.baseCurrency ?? "USD",
      quoteCurrency: data?.quoteCurrency ?? "CNY",
      rate: data?.rate ?? 1,
      capturedAt:
        data?.capturedAt instanceof Date ? data.capturedAt : new Date(),
      sourceRateId: data?.sourceRateId ?? "rate-mock",
      effectiveFrom:
        data?.effectiveFrom instanceof Date ? data.effectiveFrom : null,
      effectiveTo:
        data?.effectiveTo instanceof Date ? data.effectiveTo : null,
    }),
  );
  if (!prismaMock.eventOutbox) {
    prismaMock.eventOutbox = {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    } as unknown as typeof prismaMock.eventOutbox;
  }
  prismaMock.eventOutbox?.findMany?.mockResolvedValue([]);
  prismaMock.eventOutbox?.update?.mockImplementation(async ({ data, where }: { data: any; where: any }) => ({
    id: where?.id ?? "evt-mock",
    eventType: "mock",
    payload: {},
    status: data?.status ?? "PENDING",
    attempts: typeof data?.attempts?.increment === "number" ? data.attempts.increment : data?.attempts ?? 0,
    lastError: data?.lastError ?? null,
    occurredAt: data?.occurredAt ?? new Date(),
    availableAt: data?.availableAt ?? new Date(),
    processedAt: data?.processedAt ?? null,
    createdAt: data?.createdAt ?? new Date(),
    updatedAt: data?.updatedAt ?? new Date(),
  }));
  prismaMock.eventOutbox?.create?.mockImplementation(async ({ data }: { data: any }) => ({
    id: data?.id ?? "evt-mock",
    eventType: data?.eventType ?? "mock",
    payload: data?.payload ?? {},
    status: data?.status ?? "PENDING",
    attempts: data?.attempts ?? 0,
    lastError: data?.lastError ?? null,
    occurredAt: data?.occurredAt ?? new Date(),
    availableAt: data?.availableAt ?? new Date(),
    processedAt: data?.processedAt ?? null,
    createdAt: data?.createdAt ?? new Date(),
    updatedAt: data?.updatedAt ?? new Date(),
  }));
  if (!prismaMock.reportDataset) {
    prismaMock.reportDataset = {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    } as unknown as typeof prismaMock.reportDataset;
  }
  prismaMock.reportDataset.findUnique.mockResolvedValue(null);
  prismaMock.reportDataset.upsert.mockImplementation(
    async ({ create, update, where }: { create: any; update: any; where: any }) => ({
      id: create?.id ?? "report-dataset",
      userId: create?.userId ?? update?.userId ?? where?.userId_scope_bucket?.userId ?? "u1",
      scope: create?.scope ?? update?.scope ?? where?.userId_scope_bucket?.scope ?? "accounts.summary",
      bucket: create?.bucket ?? update?.bucket ?? where?.userId_scope_bucket?.bucket ?? "default",
      payload: create?.payload ?? update?.payload ?? {},
      occurredAt: create?.occurredAt ?? update?.occurredAt ?? null,
      createdAt: create?.createdAt ?? new Date(),
      updatedAt: create?.updatedAt ?? new Date(),
    }),
  );
  if (!prismaMock.auditLog) {
    prismaMock.auditLog = {
      create: vi.fn(),
    } as unknown as typeof prismaMock.auditLog;
  }
  prismaMock.auditLog.create.mockImplementation(async ({ data }: { data: any }) => ({
    id: data?.id ?? "audit-mock",
    action: data?.action ?? "",
    userId: data?.userId ?? null,
    meta: data?.meta ?? null,
    createdAt: data?.createdAt ?? new Date(),
  }));
  prismaMock.incomeRecalcTask?.findMany?.mockResolvedValue([]);
  prismaMock.incomeRecalcTask?.findFirst?.mockResolvedValue(null);
  prismaMock.incomeRecalcTask?.updateMany?.mockResolvedValue({ count: 0 });
  if (prismaMock.incomeRecalcTask?.create) {
    prismaMock.incomeRecalcTask.create.mockImplementation(async ({ data }: { data: any }) =>
      buildIncomeRecalcTask({
        id: data?.id ?? "task-mock",
        userId: data?.userId ?? null,
        taxYear: data?.taxYear ?? 2025,
        startMonth: data?.startMonth ?? 1,
        endMonth: data?.endMonth ?? 12,
        cityId: data?.cityId ?? null,
        status: data?.status ?? "PENDING",
        scheduledFor:
          data?.scheduledFor instanceof Date ? data.scheduledFor : new Date(),
        attempts: typeof data?.attempts === "number" ? data.attempts : 0,
        triggeredBy: data?.triggeredBy ?? null,
        createdAt:
          data?.createdAt instanceof Date ? data.createdAt : new Date(),
        updatedAt:
          data?.updatedAt instanceof Date ? data.updatedAt : new Date(),
        processedAt:
          data?.processedAt instanceof Date ? data.processedAt : null,
        lastError: data?.lastError ?? null,
      }),
    );
  }
  if (prismaMock.incomeRecalcTask?.update) {
    prismaMock.incomeRecalcTask.update.mockImplementation(
      async ({ data, where }: { data: any; where: any }) =>
        buildIncomeRecalcTask({
          id: where?.id ?? "task-mock",
          userId: data?.userId ?? null,
          taxYear: data?.taxYear ?? where?.taxYear ?? 2025,
          startMonth: data?.startMonth ?? where?.startMonth ?? 1,
          endMonth: data?.endMonth ?? where?.endMonth ?? 12,
          cityId: data?.cityId ?? null,
          status: data?.status ?? "PENDING",
          scheduledFor:
            data?.scheduledFor instanceof Date ? data.scheduledFor : new Date(),
          attempts: typeof data?.attempts === "number" ? data.attempts : 0,
          processedAt:
            data?.processedAt instanceof Date ? data.processedAt : null,
          lastError: data?.lastError ?? null,
          triggeredBy: data?.triggeredBy ?? null,
          createdAt:
            data?.createdAt instanceof Date ? data.createdAt : new Date(),
          updatedAt:
            data?.updatedAt instanceof Date ? data.updatedAt : new Date(),
        }),
    );
  }
  prismaMock.incomeRecord?.findMany?.mockResolvedValue([]);
  prismaMock.incomeRecord?.findFirst?.mockResolvedValue(null);
  prismaMock.incomeChange?.findMany?.mockResolvedValue([]);
  prismaMock.bonusPlan?.findMany?.mockResolvedValue([]);
  prismaMock.longTermCashPlan?.findMany?.mockResolvedValue([]);
  prismaMock.longTermCashPayout?.findMany?.mockResolvedValue([]);
  prismaMock.equityVest?.findMany?.mockResolvedValue([]);
  prismaMock.user?.findMany?.mockResolvedValue([]);
  prismaMock.user?.findUnique?.mockResolvedValue(null);
  prismaMock.cityChangeRecord?.findMany?.mockResolvedValue([]);
  prismaMock.cityChangeRecord?.findFirst?.mockResolvedValue(null);
  prismaMock.city?.findMany?.mockResolvedValue([]);
  prismaMock.city?.findUnique?.mockResolvedValue(null);
  const buildDefaultTaxConfig = () => ({
    id: "tax-cn-2025",
    country: "CN",
    taxYear: 2025,
    currency: "CNY",
    standardDeduction: 5000,
    specialAdditionalDeduction: 0,
    effectiveFrom: new Date("2025-01-01T00:00:00Z"),
    effectiveTo: null as Date | null,
    brackets: [
      {
        id: "tax-cn-2025-1",
        country: "CN",
        taxYear: 2025,
        position: 1,
        threshold: 36000,
        taxRate: 0.03,
        quickDeduction: 0,
        effectiveFrom: new Date("2025-01-01T00:00:00Z"),
        effectiveTo: null as Date | null,
      },
      {
        id: "tax-cn-2025-2",
        country: "CN",
        taxYear: 2025,
        position: 2,
        threshold: 144000,
        taxRate: 0.1,
        quickDeduction: 2520,
        effectiveFrom: new Date("2025-01-01T00:00:00Z"),
        effectiveTo: null as Date | null,
      },
      {
        id: "tax-cn-2025-3",
        country: "CN",
        taxYear: 2025,
        position: 3,
        threshold: 300000,
        taxRate: 0.2,
        quickDeduction: 16920,
        effectiveFrom: new Date("2025-01-01T00:00:00Z"),
        effectiveTo: null as Date | null,
      },
    ],
  });
  const defaultConfig = buildDefaultTaxConfig();
  prismaMock.taxConfig?.findFirst?.mockResolvedValue(defaultConfig);
  prismaMock.taxConfig?.findUnique?.mockResolvedValue(defaultConfig);
  prismaMock.taxBracket?.findMany?.mockResolvedValue(defaultConfig.brackets);
  prismaMock.userAnnualDeduction?.findMany?.mockResolvedValue([]);
  clearTaxContextCache();
}

export function stubResolved<T>(fn: ReturnType<typeof vi.fn>, value: T) {
  fn.mockResolvedValue(value);
  return fn;
}
