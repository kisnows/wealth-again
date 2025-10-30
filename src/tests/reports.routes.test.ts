import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeGet } from "@/tests/helpers";
import { prismaMock, resetPrismaMock } from "@/tests/helpers/prismaMock";

const mockPrisma = prismaMock;

beforeEach(() => {
  vi.clearAllMocks();
  resetPrismaMock();
});

describe("Reports routes", () => {
  it("accounts summary returns 200", async () => {
    const m = await import("@/app/api/v1/reporting/accounts/summary/route");
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
        "http://localhost/api/v1/reporting/accounts/summary?displayCurrency=CNY",
      ),
    );
    expect(res.status).toBe(200);
    const j = await res.json();
    // displayValue = 100 USD * 7 = 700 CNY
    expect(j.displayCurrency).toBe("CNY");
    expect(j.items[0].displayValue).toBe(700);
    expect(j.items[0].displayPrincipal).toBe(0);
    expect(j.items[0].displayProfit).toBe(700);
    expect(j.totals.assets).toBe(700);
    expect(j.totals.liabilities).toBe(0);
    expect(j.totals.netWorth).toBe(700);
  });

  it("dashboard returns 200", async () => {
    const m = await import("@/app/api/v1/reporting/dashboard/route");
    mockPrisma.account.findMany.mockResolvedValueOnce([]);
    mockPrisma.fxRate.findMany.mockResolvedValueOnce([]);
    const res = await m.GET(
      makeGet("http://localhost/api/v1/reporting/dashboard?displayCurrency=CNY"),
    );
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.displayCurrency).toBe("CNY");
    expect(payload.totals).toEqual({
      assets: 0,
      liabilities: 0,
      netWorth: 0,
      archived: 0,
    });
  });

  it("income timeseries returns series for given range", async () => {
    const m = await import("@/app/api/v1/reporting/income/timeseries/route");
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "u1",
      currentCityId: "c1",
      currentCity: { country: "CN" },
    });
    mockPrisma.incomeRecord.findMany.mockResolvedValueOnce([
      {
        monthDate: new Date("2025-01-01"),
        gross: 10000,
        bonus: 0,
        ltcIncome: 0,
        equityIncome: 0,
        socialInsurance: 0,
        housingFund: 0,
        incomeTax: 300,
        netIncome: 9700,
      },
    ]);
    const res = await m.GET(
      makeGet(
        "http://localhost/api/v1/reporting/income/timeseries?from=2025-01-01&to=2025-12-01&userId=u1",
      ),
    );
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.series.gross.length).toBe(1);
    expect(j.series.incomeTax[0].value).toBe(300);
  });
});
