import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeGet } from "@/tests/helpers";

const mockPrisma: any = {
  account: { findMany: vi.fn() },
  fxRate: { findMany: vi.fn() },
  incomeChange: { findFirst: vi.fn().mockResolvedValue(null) },
  bonusPlan: { findMany: vi.fn().mockResolvedValue([]) },
  longTermCashPayout: { findMany: vi.fn().mockResolvedValue([]) },
  equityVest: { findMany: vi.fn().mockResolvedValue([]) },
  userAnnualDeduction: {
    findUnique: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
  },
  incomeRecord: {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
  },
};

// 报表依赖账户估值与汇率，统一在此 mock
vi.mock("@/server/db", () => ({ default: mockPrisma }));

beforeEach(() => {
  vi.clearAllMocks();
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
        "http://localhost/api/v1/reports/accounts/summary?displayCurrency=CNY",
      ),
    );
    expect(res.status).toBe(200);
    const j = await res.json();
    // displayValue = 100 USD * 7 = 700 CNY
    expect(j.items[0].displayValue).toBe(700);
  });

  it("dashboard returns 200", async () => {
    // 用例：Dashboard 报表在无数据时也应返回 200，确保空态可渲染。
    const m = await import("@/app/api/v1/reports/dashboard/route");
    mockPrisma.account.findMany.mockResolvedValueOnce([]);
    mockPrisma.fxRate.findMany.mockResolvedValueOnce([]);
    expect(
      (
        await m.GET(
          makeGet(
            "http://localhost/api/v1/reports/dashboard?displayCurrency=CNY",
          ),
        )
      ).status,
    ).toBe(200);
  });

  it("income timeseries returns series for given range", async () => {
    // 用例：收入时序接口按时间范围返回单月数据，需包含税额与净收入序列。
    const m = await import("@/app/api/v1/reports/income/timeseries/route");
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
        "http://localhost/api/v1/reports/income/timeseries?from=2025-01-01&to=2025-12-01&userId=u1",
      ),
    );
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.series.gross.length).toBe(1);
    expect(j.series.incomeTax[0].value).toBe(300);
  });
});
