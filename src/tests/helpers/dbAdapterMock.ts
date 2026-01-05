import { vi } from "vitest";
import {
  queueDeleteResults,
  queueInsertResults,
  queueSelectResults,
  queueUpdateResults,
  resetDbMock,
} from "@/tests/helpers/dbMock";

type MockFn = ReturnType<typeof vi.fn>;

function wrapQueue<T>(fn: MockFn, queue: (value: T) => void) {
  const originalOnce = fn.mockResolvedValueOnce.bind(fn);
  fn.mockResolvedValueOnce = (value: T) => {
    queue(value);
    return originalOnce(value);
  };
  const original = fn.mockResolvedValue.bind(fn);
  fn.mockResolvedValue = (value: T) => {
    queue(value);
    return original(value);
  };
  return fn;
}

const createSelectMock = () =>
  wrapQueue(vi.fn(), queueSelectResults);
const createInsertMock = () =>
  wrapQueue(vi.fn(), queueInsertResults);
const createUpdateMock = () =>
  wrapQueue(vi.fn(), queueUpdateResults);
const createDeleteMock = () =>
  wrapQueue(vi.fn(), queueDeleteResults);

const createMockMethods = () => ({
  findUnique: createSelectMock(),
  findFirst: createSelectMock(),
  findMany: createSelectMock(),
  create: createInsertMock(),
  createMany: createInsertMock(),
  update: createUpdateMock(),
  updateMany: createUpdateMock(),
  upsert: createUpdateMock(),
  delete: createDeleteMock(),
  deleteMany: createDeleteMock(),
  aggregate: vi.fn(),
  count: vi.fn(),
  groupBy: vi.fn(),
});

const models = [
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
  "fxRateUpdateTask",
  "fxRateUpdateLog",
  "eventOutbox",
  "reportDataset",
];

export const dbAdapterMock = models.reduce((acc, model) => {
  acc[model] = createMockMethods();
  return acc;
}, {} as Record<string, ReturnType<typeof createMockMethods>>);

dbAdapterMock.$transaction = vi.fn().mockImplementation(async (fn) => fn(dbAdapterMock));
dbAdapterMock.$connect = vi.fn();
dbAdapterMock.$disconnect = vi.fn();
dbAdapterMock.$use = vi.fn();

export function resetDbAdapterMock() {
  resetDbMock();
  for (const model of models) {
    const methods = dbAdapterMock[model];
    for (const key of Object.keys(methods)) {
      const fn = methods[key];
      if (typeof fn?.mockReset === "function") {
        fn.mockReset();
      }
    }
  }
  dbAdapterMock.$transaction.mockReset();
  dbAdapterMock.$transaction.mockImplementation(async (fn) => fn(dbAdapterMock));
  dbAdapterMock.$connect.mockReset();
  dbAdapterMock.$disconnect.mockReset();
  dbAdapterMock.$use.mockReset();
}
