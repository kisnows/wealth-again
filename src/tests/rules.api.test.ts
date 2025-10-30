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
    // 用例：城市配置写入需携带幂等键并记录审计日志，确保重复请求可判别。
    const m = await import("@/app/api/v1/rules/cities/route");
    mockPrisma.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    mockPrisma.city.upsert.mockResolvedValue({});
    const res = await m.PUT(
      makeJsonRequest(
        "http://localhost/api/v1/rules/cities",
        "PUT",
        [{ name: "Hangzhou" }],
        { "Idempotency-Key": "k1" },
      ),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });

  it("ss GET returns rule and PUT overlaps 409", async () => {
    // 用例：查询已存在的社保规则并尝试写入重叠区间时，接口应返回 409。
    const ss = await import("@/app/api/v1/rules/social-security/route");
    mockPrisma.city.findUnique.mockResolvedValueOnce({
      id: "c1",
      name: "Hangzhou",
    });
    mockPrisma.cityRuleSS.findFirst.mockResolvedValueOnce({ id: "ss1" });
    expect(
      (
        await ss.GET(
          makeGet(
            "http://localhost/api/v1/rules/social-security?city=Hangzhou&on=2025-01-01",
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
        "http://localhost/api/v1/rules/social-security",
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
    // 用例：公积金规则查询与写入的 happy path，验证返回 200 且数据通过幂等校验。
    const hf = await import("@/app/api/v1/rules/housing-fund/route");
    mockPrisma.city.findUnique.mockResolvedValueOnce({
      id: "c1",
      name: "Hangzhou",
    });
    mockPrisma.cityRuleHF.findFirst.mockResolvedValueOnce({ id: "hf1" });
    expect(
      (
        await hf.GET(
          makeGet(
            "http://localhost/api/v1/rules/housing-fund?city=Hangzhou&on=2025-01-01",
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
            "http://localhost/api/v1/rules/housing-fund",
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
    // 用例：当提交区间与现有规则不重叠时，应成功创建并返回 200。
    const ss = await import("@/app/api/v1/rules/social-security/route");
    mockPrisma.city.upsert.mockResolvedValueOnce({ id: "c1" });
    mockPrisma.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    mockPrisma.cityRuleSS.findMany.mockResolvedValueOnce([]); // 无重叠
    mockPrisma.cityRuleSS.upsert.mockResolvedValueOnce({});
    const res = await ss.PUT(
      makeJsonRequest(
        "http://localhost/api/v1/rules/social-security",
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
    // 用例：税制配置与税率表的查询 + 批量写入，用于验证字段完整性与幂等逻辑。
    const cfg = await import("@/app/api/v1/rules/tax/config/route");
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
            "http://localhost/api/v1/rules/tax/config",
            "PUT",
            { country: "CN", taxYear: 2025, standardDeduction: 5000 },
            { "Idempotency-Key": "k-tcfg" },
          ),
        )
      ).status,
    ).toBe(200);

    const br = await import("@/app/api/v1/rules/tax/brackets/route");
    mockPrisma.taxBracket.findMany.mockResolvedValueOnce([]);
    expect(
      (
        await br.GET(
          makeGet(
            "http://localhost/api/v1/rules/tax/brackets?country=CN&taxYear=2025",
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
            "http://localhost/api/v1/rules/tax/brackets",
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
    // 用例：重复使用相同幂等键写入城市时，应返回 409 阻止重复操作。
    const m = await import("@/app/api/v1/rules/cities/route");
    mockPrisma.idempotencyKey.findUnique.mockResolvedValueOnce({
      key: "k-city",
    });
    const res = await m.PUT(
      makeJsonRequest(
        "http://localhost/api/v1/rules/cities",
        "PUT",
        [{ name: "Hangzhou" }],
        { "Idempotency-Key": "k-city" },
      ),
    );
    expect(res.status).toBe(409);
  });

  it("social-security GET missing query returns 400", async () => {
    // 用例：缺少必填查询参数（on）时，社保查询接口返回 400 提示参数错误。
    const ss = await import("@/app/api/v1/rules/social-security/route");
    const res = await ss.GET(
      makeGet("http://localhost/api/v1/rules/social-security?city=Hangzhou"),
    );
    expect(res.status).toBe(400);
  });

  it("tax brackets GET missing params returns 400", async () => {
    // 用例：缺少年份参数时，税率表查询接口返回 400，提醒补齐请求条件。
    const br = await import("@/app/api/v1/rules/tax/brackets/route");
    const res = await br.GET(
      makeGet("http://localhost/api/v1/rules/tax/brackets?country=CN"),
    );
    expect(res.status).toBe(400);
  });
});
