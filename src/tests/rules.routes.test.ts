import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeGet, makeJsonRequest } from "@/tests/helpers";
import { prismaMock, resetPrismaMock } from "@/tests/helpers/prismaMock";

const mockPrisma = prismaMock;

beforeEach(() => {
  vi.clearAllMocks();
  resetPrismaMock();
});

describe("Rules routes", () => {
  it("cities PUT with idempotency & audit", async () => {
    const m = await import("@/app/api/v1/income-tax/rules/cities/route");
    mockPrisma.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    mockPrisma.city.upsert.mockResolvedValue({});
    const res = await m.PUT(
      makeJsonRequest(
        "http://localhost/api/v1/income-tax/rules/cities",
        "PUT",
        [{ name: "Hangzhou" }],
        { "Idempotency-Key": "k1" },
      ),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });

  it("ss GET returns rule and PUT overlaps 409", async () => {
    const ss = await import("@/app/api/v1/income-tax/rules/social-security/route");
    mockPrisma.city.findUnique.mockResolvedValueOnce({
      id: "c1",
      name: "Hangzhou",
    });
    mockPrisma.cityRuleSS.findFirst.mockResolvedValueOnce({ id: "ss1" });
    expect(
      (
        await ss.GET(
          makeGet(
            "http://localhost/api/v1/income-tax/rules/social-security?city=Hangzhou&on=2025-01-01",
          ),
        )
      ).status,
    ).toBe(200);

    mockPrisma.city.upsert.mockResolvedValueOnce({ id: "c1" });
    mockPrisma.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    mockPrisma.cityRuleSS.findMany.mockResolvedValueOnce([
      {
        cityId: "c1",
        effectiveFrom: new Date("2025-01-01"),
        effectiveTo: new Date("2026-01-01"),
      },
    ]);
    const res = await ss.PUT(
      makeJsonRequest(
        "http://localhost/api/v1/income-tax/rules/social-security",
        "PUT",
        [
          {
            city: "Hangzhou",
            startDate: "2025-06-01",
            endDate: "2025-12-01",
            baseMin: 1,
            baseMax: 2,
            ratePension: 0.08,
            rateMedical: 0.02,
            rateUnemployment: 0.005,
          },
        ],
        { "Idempotency-Key": "k-ss" },
      ),
    );
    expect(res.status).toBe(409);
  });

  it("hf GET ok and PUT ok", async () => {
    const hf = await import("@/app/api/v1/income-tax/rules/housing-fund/route");
    mockPrisma.city.findUnique.mockResolvedValueOnce({
      id: "c1",
      name: "Hangzhou",
    });
    mockPrisma.cityRuleHF.findFirst.mockResolvedValueOnce({ id: "hf1" });
    expect(
      (
        await hf.GET(
          makeGet(
            "http://localhost/api/v1/income-tax/rules/housing-fund?city=Hangzhou&on=2025-01-01",
          ),
        )
      ).status,
    ).toBe(200);

    mockPrisma.city.upsert.mockResolvedValueOnce({ id: "c1" });
    mockPrisma.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    mockPrisma.cityRuleHF.findMany.mockResolvedValueOnce([]);
    mockPrisma.cityRuleHF.upsert.mockResolvedValue({});
    expect(
      (
        await hf.PUT(
          makeJsonRequest(
            "http://localhost/api/v1/income-tax/rules/housing-fund",
            "PUT",
            [
              {
                city: "Hangzhou",
                startDate: "2025-01-01",
                baseMin: 1,
                baseMax: 2,
                rateEmployee: 0.12,
              },
            ],
            { "Idempotency-Key": "k-hf" },
          ),
        )
      ).status,
    ).toBe(200);
  });

  it("ss PUT non-overlap returns 200", async () => {
    const ss = await import("@/app/api/v1/income-tax/rules/social-security/route");
    mockPrisma.city.upsert.mockResolvedValueOnce({ id: "c1" });
    mockPrisma.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    mockPrisma.cityRuleSS.findMany.mockResolvedValueOnce([]); // 无重叠
    mockPrisma.cityRuleSS.upsert.mockResolvedValueOnce({});
    const res = await ss.PUT(
      makeJsonRequest(
        "http://localhost/api/v1/income-tax/rules/social-security",
        "PUT",
        [
          {
            city: "Hangzhou",
            startDate: "2025-01-01",
            endDate: "2025-06-01",
            baseMin: 1,
            baseMax: 2,
            ratePension: 0.08,
            rateMedical: 0.02,
            rateUnemployment: 0.005,
          },
        ],
        { "Idempotency-Key": "k-ss-ok" },
      ),
    );
    expect(res.status).toBe(200);
  });

  it("tax config/brackets PUT/GET", async () => {
    const cfg = await import("@/app/api/v1/income-tax/rules/tax/config/route");
    mockPrisma.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    mockPrisma.taxConfig.upsert.mockResolvedValueOnce({
      country: "CN",
      taxYear: 2025,
      standardDeduction: 5000,
    });
    expect(
      (
        await cfg.PUT(
          makeJsonRequest(
            "http://localhost/api/v1/income-tax/rules/tax/config",
            "PUT",
            { country: "CN", taxYear: 2025, standardDeduction: 5000 },
            { "Idempotency-Key": "k-tcfg" },
          ),
        )
      ).status,
    ).toBe(200);

    const br = await import("@/app/api/v1/income-tax/rules/tax/brackets/route");
    mockPrisma.taxBracket.findMany.mockResolvedValueOnce([]);
    expect(
      (
        await br.GET(
          makeGet(
            "http://localhost/api/v1/income-tax/rules/tax/brackets?country=CN&taxYear=2025",
          ),
        )
      ).status,
    ).toBe(200);
    mockPrisma.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    mockPrisma.taxBracket.upsert.mockResolvedValue({});
    expect(
      (
        await br.PUT(
          makeJsonRequest(
            "http://localhost/api/v1/income-tax/rules/tax/brackets",
            "PUT",
            [
              {
                country: "CN",
                taxYear: 2025,
                position: 1,
                threshold: 36000,
                taxRate: 0.03,
                quickDeduction: 0,
              },
            ],
            { "Idempotency-Key": "k-tbr" },
          ),
        )
      ).status,
    ).toBe(200);
  });

  it("cities PUT idempotency reuse returns 409", async () => {
    const m = await import("@/app/api/v1/income-tax/rules/cities/route");
    mockPrisma.idempotencyKey.findUnique.mockResolvedValueOnce({
      key: "k-city",
    });
    const res = await m.PUT(
      makeJsonRequest(
        "http://localhost/api/v1/income-tax/rules/cities",
        "PUT",
        [{ name: "Hangzhou" }],
        { "Idempotency-Key": "k-city" },
      ),
    );
    expect(res.status).toBe(409);
  });

  it("social-security GET missing query returns 400", async () => {
    const ss = await import("@/app/api/v1/income-tax/rules/social-security/route");
    const res = await ss.GET(
      makeGet("http://localhost/api/v1/income-tax/rules/social-security?city=Hangzhou"),
    );
    expect(res.status).toBe(400);
  });

  it("tax brackets GET missing params returns 400", async () => {
    const br = await import("@/app/api/v1/income-tax/rules/tax/brackets/route");
    const res = await br.GET(
      makeGet("http://localhost/api/v1/income-tax/rules/tax/brackets?country=CN"),
    );
    expect(res.status).toBe(400);
  });
});
