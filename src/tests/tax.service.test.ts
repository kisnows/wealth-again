import { beforeEach, describe, expect, it, vi } from "vitest";

type MockedFn = ReturnType<typeof vi.fn>;

const mockPrisma = {
  taxConfig: { findFirst: vi.fn(), findUnique: vi.fn() },
  taxBracket: { findMany: vi.fn() },
} satisfies {
  taxConfig: { findFirst: MockedFn; findUnique: MockedFn };
  taxBracket: { findMany: MockedFn };
};

// 税务服务仅依赖 taxConfig（含 brackets），在此提供最小 mock
vi.mock("@/server/db", () => ({ default: mockPrisma }));

beforeEach(async () => {
  vi.clearAllMocks();
  mockPrisma.taxBracket.findMany.mockResolvedValue([]);
  const { clearTaxContextCache } = await import("@/server/services/tax");
  clearTaxContextCache();
});

describe("TaxService.calculateTax", () => {
  it("computes increasing cumulative paid", async () => {
    const { calculateTax } = await import("@/server/services/tax");
    mockPrisma.taxConfig.findFirst.mockResolvedValue({
      id: "cfg-cn-2025",
      country: "CN",
      taxYear: 2025,
      standardDeduction: 5000,
      specialAdditionalDeduction: 1000,
      currency: "CNY",
      brackets: [
        {
          threshold: 36000,
          taxRate: 0.03,
          quickDeduction: 0,
          position: 1,
        },
        {
          threshold: 144000,
          taxRate: 0.1,
          quickDeduction: 2520,
          position: 2,
        },
        {
          threshold: 1_000_000_000,
          taxRate: 0.45,
          quickDeduction: 181920,
          position: 7,
        },
      ],
    });
    const res = await calculateTax({
      country: "CN",
      taxYear: 2025,
      monthlyTaxables: [10000, 20000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    expect(res[0].monthTax).toBeGreaterThan(0);
    expect(res[1].cumulativePaid).toBeGreaterThan(res[0].cumulativePaid);
  });
});
