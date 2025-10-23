// Global test setup for Vitest
import { config as loadEnv } from "dotenv";
import { vi } from "vitest";

loadEnv({ path: ".env", quiet: true });

// Default DATABASE_URL fallback for local sqlite if absent
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./prisma/dev.db";
}

// --- Global Prisma Mock ---
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
];

const createMockMethods = () => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  createMany: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
  aggregate: vi.fn(),
  count: vi.fn(),
  groupBy: vi.fn(),
});

const mockPrisma = models.reduce((acc, model) => {
  acc[model] = createMockMethods();
  return acc;
}, {} as any);

mockPrisma.$transaction = vi.fn().mockImplementation(async (fn) => fn(mockPrisma));
mockPrisma.$connect = vi.fn();
mockPrisma.$disconnect = vi.fn();
mockPrisma.$use = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: mockPrisma,
  default: mockPrisma,
}));
