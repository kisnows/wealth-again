import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeGet, makeJsonRequest } from "@/tests/helpers";

const mockPrisma: any = {
  fxRate: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
};

// 使用局部 mock Prisma，确保该测试文件内的行为可控
vi.mock("@/server/db", () => ({ default: mockPrisma }));

beforeEach(() => vi.clearAllMocks());

describe("FX routes", () => {
  it("GET /fxrates returns nearest asOf match", async () => {
    // 用例：查询指定日期的汇率快照时，接口应返回最近的匹配记录。
    const m = await import("@/app/api/v1/fxrates/route");
    mockPrisma.fxRate.findFirst.mockResolvedValueOnce({
      id: "r1",
      base: "USD",
      quote: "CNY",
      rate: 7.2,
      asOf: new Date("2025-08-01"),
    });
    const res = await m.GET(
      makeGet(
        "http://localhost/api/v1/fxrates?base=USD&quote=CNY&on=2025-08-01",
      ),
    );
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.rate).toBe(7.2);
  });

  it("GET /fxrates missing quote -> 400", async () => {
    // 用例：缺少 quote 参数时需返回 400，提示请求不完整。
    const m = await import("@/app/api/v1/fxrates/route");
    const res = await m.GET(
      makeGet("http://localhost/api/v1/fxrates?base=USD"),
    );
    expect(res.status).toBe(400);
  });

  it("GET /fxrates without on returns latest snapshot", async () => {
    // 用例：未提供 on 参数时，接口应回落到最新快照。
    const m = await import("@/app/api/v1/fxrates/route");
    mockPrisma.fxRate.findFirst.mockResolvedValueOnce({
      id: "r-latest",
      base: "USD",
      quote: "EUR",
      rate: 0.9,
      asOf: new Date("2025-08-03"),
    });
    const res = await m.GET(
      makeGet("http://localhost/api/v1/fxrates?base=USD&quote=EUR"),
    );
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.id).toBe("r-latest");
  });

  it("POST /fxrates invalid body -> 400", async () => {
    // 用例：POST 请求缺省必填字段时返回 400，阻止写入。
    const m = await import("@/app/api/v1/fxrates/route");
    const res = await m.POST(
      makeJsonRequest("http://localhost/api/v1/fxrates", "POST", {
        base: "USD",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("POST /fxrates creates snapshot", async () => {
    // 用例：POST 提交完整参数时成功创建汇率快照并返回 201。
    const m = await import("@/app/api/v1/fxrates/route");
    mockPrisma.fxRate.create.mockResolvedValueOnce({ id: "r2" });
    const res = await m.POST(
      makeJsonRequest("http://localhost/api/v1/fxrates", "POST", {
        base: "USD",
        quote: "CNY",
        rate: 7.1,
        asOf: "2025-08-02",
      }),
    );
    expect(res.status).toBe(201);
  });

  it("GET /fxrates/latest aggregates latest snapshot per currency", async () => {
    // 用例：批量查询时需返回每个币种最新的 USD 中间价，缺失的币种以 null 标记。
    const m = await import("@/app/api/v1/fxrates/latest/route");
    mockPrisma.fxRate.findMany.mockResolvedValueOnce([
      {
        base: "USD",
        quote: "CNY",
        rate: 7.1,
        asOf: new Date("2025-08-01"),
      },
      {
        base: "USD",
        quote: "CNY",
        rate: 7.05,
        asOf: new Date("2025-07-01"),
      },
    ]);
    const res = await m.GET(
      makeGet("http://localhost/api/v1/fxrates/latest?quotes=CNY,HKD"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([
      {
        quote: "CNY",
        rate: 7.1,
        asOf: "2025-08-01T00:00:00.000Z",
      },
      {
        quote: "HKD",
        rate: null,
        asOf: null,
      },
    ]);
  });
});

describe("FX service", () => {
  it("convert uses USD pivot for CNY→EUR", async () => {
    // 用例：服务层应通过 USD 中间价转换，将 CNY 金额折算为 EUR。
    const { convert } = await import("@/server/services/fx");
    const asOf = new Date("2025-08-01");
  mockPrisma.fxRate.findFirst
    .mockResolvedValueOnce({ base: "USD", quote: "CNY", rate: 7, asOf })
    .mockResolvedValueOnce({ base: "USD", quote: "EUR", rate: 0.9, asOf });
  const out = await convert(7, "CNY", "EUR", asOf);
  expect(out.amount).toBeCloseTo(0.9, 6);
  expect(out.effectiveRate).toBeCloseTo(0.128571, 6);
  expect(out.snapshots).toHaveLength(2);
  });

  it("getLatestRates returns latest record per quote and fills missing", async () => {
    // 用例：服务层批量查询需取每个币种的最新快照，并保留缺失项。
    const { getLatestRates } = await import("@/server/services/fx");
    mockPrisma.fxRate.findMany.mockResolvedValueOnce([
      {
        base: "USD",
        quote: "CNY",
        rate: 7.2,
        asOf: new Date("2025-08-01"),
      },
      {
        base: "USD",
        quote: "EUR",
        rate: 0.9,
        asOf: new Date("2025-08-01"),
      },
      {
        base: "USD",
        quote: "CNY",
        rate: 7.1,
        asOf: new Date("2025-07-01"),
      },
    ]);
    const results = await getLatestRates("USD", ["CNY", "HKD", "EUR"]);
    expect(results).toEqual([
      { quote: "CNY", rate: 7.2, asOf: new Date("2025-08-01") },
      { quote: "HKD", rate: null, asOf: null },
      { quote: "EUR", rate: 0.9, asOf: new Date("2025-08-01") },
    ]);
  });
});
