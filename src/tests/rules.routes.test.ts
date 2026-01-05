import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeGet, makeJsonRequest } from "@/tests/helpers";
import { resetDbMock, setSelectFallback } from "@/tests/helpers/dbMock";
import {
  cities,
  cityRuleHF,
  cityRuleSS,
  idempotencyKeys,
  taxBracket,
} from "@/server/db/schema";

const logAuditMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/server/services/audit", () => ({
  logAudit: logAuditMock,
}));

let fallbackCities: any[] = [];
let cityRuleSSResponses: any[][] = [];
let cityRuleHFResponses: any[][] = [];
let fallbackIdempotencyKeys: any[] = [];
let fallbackTaxBracket: any[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock();
  fallbackCities = [];
  cityRuleSSResponses = [];
  cityRuleHFResponses = [];
  fallbackIdempotencyKeys = [];
  fallbackTaxBracket = [];
  setSelectFallback(({ table, tableCallIndex }) => {
    if (table === cities) return fallbackCities;
    if (table === cityRuleSS) return cityRuleSSResponses[tableCallIndex] ?? [];
    if (table === cityRuleHF) return cityRuleHFResponses[tableCallIndex] ?? [];
    if (table === idempotencyKeys) return fallbackIdempotencyKeys;
    if (table === taxBracket) return fallbackTaxBracket;
    return [];
  });
});

describe("Rules routes", () => {
  it("cities PUT with idempotency & audit", async () => {
    const m = await import("@/app/api/v1/income-tax/rules/cities/route");
    fallbackIdempotencyKeys = [];
    const res = await m.PUT(
      makeJsonRequest(
        "http://localhost/api/v1/income-tax/rules/cities",
        "PUT",
        [{ name: "Hangzhou" }],
        { "Idempotency-Key": "k1" },
      ),
    );
    expect(res.status).toBe(200);
    expect(logAuditMock).toHaveBeenCalled();
  });

  it("ss GET returns rule and PUT overlaps 409", async () => {
    const ss = await import("@/app/api/v1/income-tax/rules/social-security/route");
    fallbackCities = [{ id: "c1", name: "Hangzhou" }];
    cityRuleSSResponses = [
      [
        {
          id: "ss1",
          cityId: "c1",
          effectiveFrom: new Date("2024-01-01"),
          effectiveTo: new Date("2026-01-01"),
        },
      ],
      [
        {
          cityId: "c1",
          effectiveFrom: new Date("2025-01-01"),
          effectiveTo: new Date("2026-01-01"),
        },
      ],
    ];
    expect(
      (
        await ss.GET(
          makeGet(
            "http://localhost/api/v1/income-tax/rules/social-security?city=Hangzhou&on=2025-01-01",
          ),
        )
      ).status,
    ).toBe(200);

    fallbackIdempotencyKeys = [];
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
    fallbackCities = [{ id: "c1", name: "Hangzhou" }];
    cityRuleHFResponses = [
      [
        {
          id: "hf1",
          cityId: "c1",
          effectiveFrom: new Date("2024-01-01"),
          effectiveTo: new Date("2026-01-01"),
        },
      ],
      [],
    ];
    expect(
      (
        await hf.GET(
          makeGet(
            "http://localhost/api/v1/income-tax/rules/housing-fund?city=Hangzhou&on=2025-01-01",
          ),
        )
      ).status,
    ).toBe(200);

    fallbackIdempotencyKeys = [];
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
    fallbackIdempotencyKeys = [];
    cityRuleSSResponses = [[]];
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
    fallbackIdempotencyKeys = [];
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
    fallbackTaxBracket = [];
    expect(
      (
        await br.GET(
          makeGet(
            "http://localhost/api/v1/income-tax/rules/tax/brackets?country=CN&taxYear=2025",
          ),
        )
      ).status,
    ).toBe(200);
    fallbackIdempotencyKeys = [];
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
    fallbackIdempotencyKeys = [{ key: "k-city" }];
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
