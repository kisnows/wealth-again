import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeJsonRequest, makeGet } from "@/tests/helpers";

const mockPrisma: any = {
  fxRate: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
};

// 使用局部 mock Prisma，确保该测试文件内的行为可控
vi.mock("@/server/db", () => ({ default: mockPrisma }));

beforeEach(() => vi.clearAllMocks());

describe("FX routes", () => {
  it("GET /fxrates returns nearest asOf match", async () => {
    const m = await import("@/app/api/v1/fxrates/route");
    mockPrisma.fxRate.findFirst.mockResolvedValueOnce({ id: "r1", base: "USD", quote: "CNY", rate: 7.2, asOf: new Date("2025-08-01") });
    const res = await m.GET(makeGet("http://localhost/api/v1/fxrates?base=USD&quote=CNY&on=2025-08-01"));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.rate).toBe(7.2);
  });

  it("GET /fxrates missing quote -> 400", async () => {
    const m = await import("@/app/api/v1/fxrates/route");
    const res = await m.GET(makeGet("http://localhost/api/v1/fxrates?base=USD"));
    expect(res.status).toBe(400);
  });

  it("GET /fxrates without on returns latest snapshot", async () => {
    const m = await import("@/app/api/v1/fxrates/route");
    mockPrisma.fxRate.findFirst.mockResolvedValueOnce({ id: "r-latest", base: "USD", quote: "EUR", rate: 0.9, asOf: new Date("2025-08-03") });
    const res = await m.GET(makeGet("http://localhost/api/v1/fxrates?base=USD&quote=EUR"));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.id).toBe("r-latest");
  });

  it("POST /fxrates invalid body -> 400", async () => {
    const m = await import("@/app/api/v1/fxrates/route");
    const res = await m.POST(makeJsonRequest("http://localhost/api/v1/fxrates", "POST", { base: "USD" }));
    expect(res.status).toBe(400);
  });

  it("POST /fxrates creates snapshot", async () => {
    const m = await import("@/app/api/v1/fxrates/route");
    mockPrisma.fxRate.create.mockResolvedValueOnce({ id: "r2" });
    const res = await m.POST(makeJsonRequest("http://localhost/api/v1/fxrates", "POST", { base: "USD", quote: "CNY", rate: 7.1, asOf: "2025-08-02" }));
    expect(res.status).toBe(201);
  });
});

describe("FX service", () => {
  it("convert uses USD pivot for CNY→EUR", async () => {
    const { convert } = await import("@/server/services/fx");
    const asOf = new Date("2025-08-01");
    mockPrisma.fxRate.findFirst
      .mockResolvedValueOnce({ base: "USD", quote: "CNY", rate: 7, asOf })
      .mockResolvedValueOnce({ base: "USD", quote: "EUR", rate: 0.9, asOf });
    const out = await convert(7, "CNY", "EUR", asOf);
    expect(out).toBeCloseTo(0.9, 6);
  });
});
