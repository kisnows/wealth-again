import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeGet } from "@/tests/helpers";

const mockPrisma: any = {
  account: { findMany: vi.fn() },
  fxRate: { findMany: vi.fn() },
};

// 报表依赖账户估值与汇率，统一在此 mock
vi.mock("@/server/db", () => ({ default: mockPrisma }));

beforeEach(() => vi.clearAllMocks());

describe("Reports routes", () => {
  it("accounts summary returns 200", async () => {
    const m = await import("@/app/api/v1/reports/accounts/summary/route");
    mockPrisma.account.findMany.mockResolvedValueOnce([
      {
        id: "a",
        name: "AccUSD",
        baseCurrency: "USD",
        accountType: "INVESTMENT",
        initialBalance: 0,
        txnLines: [],
        valuations: [{ totalValue: 100 }],
      },
    ]);
    mockPrisma.fxRate.findMany.mockResolvedValueOnce([
      { base: "USD", quote: "USD", rate: 1, asOf: new Date("2025-08-01") },
      { base: "USD", quote: "CNY", rate: 7, asOf: new Date("2025-08-01") },
    ]);
    const res = await m.GET(
      makeGet(
        "http://localhost/api/v1/reports/accounts/summary?displayCurrency=CNY"
      )
    );
    expect(res.status).toBe(200);
    const j = await res.json();
    // displayValue = 100 USD * 7 = 700 CNY
    expect(j.items[0].displayValue).toBe(700);
  });

  it("dashboard returns 200", async () => {
    const m = await import("@/app/api/v1/reports/dashboard/route");
    mockPrisma.account.findMany.mockResolvedValueOnce([]);
    mockPrisma.fxRate.findMany.mockResolvedValueOnce([]);
    expect(
      (
        await m.GET(
          makeGet(
            "http://localhost/api/v1/reports/dashboard?displayCurrency=CNY"
          )
        )
      ).status
    ).toBe(200);
  });

  it("income timeseries returns series for given range", async () => {
    const m = await import("@/app/api/v1/reports/income/timeseries/route");
    (mockPrisma as any).incomeRecord = { findMany: vi.fn().mockResolvedValueOnce([
      { monthDate: new Date("2025-01-01"), gross: 10000, bonus: 0, ltcIncome: 0, equityIncome: 0, socialInsurance: 0, housingFund: 0, incomeTax: 300, netIncome: 9700 },
    ]) };
    const res = await m.GET(makeGet("http://localhost/api/v1/reports/income/timeseries?from=2025-01-01&to=2025-12-01&userId=u1"));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.series.gross.length).toBe(1);
    expect(j.series.incomeTax[0].value).toBe(300);
  });
});
