import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeGet } from "@/tests/helpers";
import { prismaMock, resetPrismaMock } from "@/tests/helpers/prismaMock";

const mockPrisma = prismaMock;

beforeEach(() => {
  vi.clearAllMocks();
  resetPrismaMock();
  mockPrisma.incomeChange.findFirst.mockResolvedValue(null);
  mockPrisma.bonusPlan.findMany.mockResolvedValue([]);
  mockPrisma.longTermCashPayout.findMany.mockResolvedValue([]);
  mockPrisma.equityVest.findMany.mockResolvedValue([]);
  mockPrisma.userAnnualDeduction.findUnique.mockResolvedValue(null);
  mockPrisma.userAnnualDeduction.findMany.mockResolvedValue([]);
  mockPrisma.incomeRecord.findMany.mockResolvedValue([]);
  mockPrisma.incomeRecord.findFirst.mockResolvedValue(null);
});

describe("Reports routes", () => {
  it("accounts summary returns 200", async () => {
    // 用例：账户报表需结合估值与汇率折算展示，验证接口正常返回并完成汇率换算。
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

  it("accounts summary uses cached dataset when present", async () => {
    // 场景：缓存存在时直接返回物化数据，避免重复聚合。
    const route = await import("@/app/api/v1/reporting/accounts/summary/route");
    mockPrisma.reportDataset.findUnique.mockResolvedValueOnce({
      id: "ds-accounts",
      userId: "u1",
      scope: "accounts.summary",
      bucket: "default",
      payload: {
        generatedAt: "2025-01-01T00:00:00.000Z",
        totals: { assets: 5000, liabilities: 2000, netWorth: 3000, archived: 0 },
        displayCurrency: null,
        items: [],
      },
      occurredAt: new Date("2025-01-01T00:00:00Z"),
      createdAt: new Date("2025-01-01T00:00:00Z"),
      updatedAt: new Date("2025-01-01T00:00:00Z"),
    });
    const res = await route.GET(
      makeGet("http://localhost/api/v1/reporting/accounts/summary"),
    );
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.totals.netWorth).toBe(3000);
    expect(mockPrisma.account.findMany).not.toHaveBeenCalled();
  });

  it("dashboard returns 200", async () => {
    // 用例：Dashboard 报表在无数据时也应返回 200，确保空态可渲染。
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
    // 用例：收入时序接口按时间范围返回单月数据，需包含税额与净收入序列。
    const m = await import("@/app/api/v1/reporting/income/timeseries/route");
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "u1",
      currentCityId: "c1",
      currentCity: { country: "CN" },
    });
    mockPrisma.incomeRecord.findMany.mockResolvedValueOnce([
      {
        monthDate: new Date("2025-01-01"),
        currency: "CNY",
        gross: 10000,
        bonus: 0,
        ltcIncome: 0,
        equityIncome: 0,
        socialInsurance: 0,
        housingFund: 0,
        specialDeductions: 0,
        otherDeductions: 0,
        incomeTax: 300,
        netIncome: 9700,
        taxableCurrent: 10000,
        taxPaidCumulative: 300,
        taxableCumulative: 10000,
        taxCumulative: 300,
        isForecast: false,
        socialInsuranceBase: null,
        housingFundBase: null,
        manualIncomeTax: null,
        manualNet: null,
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
