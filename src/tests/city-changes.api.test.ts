import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeGet, makeJsonRequest } from "@/tests/helpers";

const mockPrisma: any = {
  user: { findUnique: vi.fn(), update: vi.fn() },
  city: { findUnique: vi.fn() },
  cityChangeRecord: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
  taxConfig: { findUnique: vi.fn() },
  taxBracket: { findMany: vi.fn() },
  incomeChange: { findFirst: vi.fn() },
  bonusPlan: { findMany: vi.fn() },
  longTermCashPayout: { findMany: vi.fn() },
  equityVest: { findMany: vi.fn() },
  cityRuleSS: { findFirst: vi.fn() },
  cityRuleHF: { findFirst: vi.fn() },
  incomeRecord: { upsert: vi.fn(), findMany: vi.fn() },
  userAnnualDeduction: { findUnique: vi.fn() },
};

const recalcMock = vi.fn().mockResolvedValue({ updated: 0 });

vi.mock("@/server/db", () => ({ default: mockPrisma }));
vi.mock("@/server/utils/auth", () => ({
  getUserFromRequest: vi.fn().mockResolvedValue({ id: "u1" }),
}));
vi.mock("@/server/services/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/server/services/income", () => ({ recalcIncome: recalcMock }));

beforeEach(() => {
  vi.clearAllMocks();
  recalcMock.mockResolvedValue({ updated: 0 });
});

function futureMonth(offset = 2) {
  const now = new Date();
  const target = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1),
  );
  return {
    label: `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}`,
    year: target.getUTCFullYear(),
    month: target.getUTCMonth() + 1,
  };
}

describe("城市迁移 API", () => {
  it("GET 返回当前城市与迁移记录", async () => {
    const route = await import("@/app/api/v1/city-changes/route");
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "u1",
      currentCityId: "c1",
      currentCity: { id: "c1", name: "杭州", country: "CN" },
    });
    mockPrisma.cityChangeRecord.findMany.mockResolvedValueOnce([
      {
        id: "chg1",
        userId: "u1",
        toCityId: "c2",
        effectiveMonth: new Date("2025-04-01T00:00:00Z"),
        reason: null,
        createdAt: new Date("2025-03-10T02:00:00Z"),
        toCity: { id: "c2", name: "上海", country: "CN" },
        fromCity: { id: "c1", name: "杭州", country: "CN" },
      },
    ]);

    const res = await route.GET(
      makeGet("http://localhost/api/v1/city-changes"),
    );
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.currentCity.name).toBe("杭州");
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].toCity.name).toBe("上海");
  });

  it("POST 成功创建迁移并触发回算", async () => {
    const route = await import("@/app/api/v1/city-changes/route");
    const effective = futureMonth();
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "u1",
      currentCityId: "c1",
      currentCity: { id: "c1", name: "杭州", country: "CN" },
    });
    mockPrisma.city.findUnique.mockResolvedValueOnce({
      id: "c2",
      name: "上海",
      country: "CN",
    });
    mockPrisma.cityChangeRecord.findFirst.mockResolvedValueOnce(null);
    mockPrisma.cityChangeRecord.create.mockResolvedValueOnce({
      id: "chg2",
      toCityId: "c2",
      effectiveMonth: new Date("2025-05-01T00:00:00Z"),
      fromCityId: "c1",
      createdAt: new Date(),
      toCity: { id: "c2", name: "上海", country: "CN" },
      fromCity: { id: "c1", name: "杭州", country: "CN" },
    });
    mockPrisma.user.update.mockResolvedValueOnce({
      id: "u1",
      currentCityId: "c2",
    });

    const res = await route.POST(
      makeJsonRequest("http://localhost/api/v1/city-changes", "POST", {
        toCityId: "c2",
        effectiveMonth: effective.label,
      }),
    );

    expect(res.status).toBe(201);
    expect(mockPrisma.cityChangeRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          toCityId: "c2",
          fromCityId: "c1",
        }),
      }),
    );
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { currentCityId: "c2" },
      }),
    );
    expect(recalcMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        taxYear: effective.year,
        startMonth: effective.month,
      }),
    );
  });

  it("POST 拒绝跨国家城市迁移", async () => {
    const route = await import("@/app/api/v1/city-changes/route");
    const effective = futureMonth();
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "u1",
      currentCityId: "c1",
      currentCity: { id: "c1", name: "杭州", country: "CN" },
    });
    mockPrisma.city.findUnique.mockResolvedValueOnce({
      id: "c3",
      name: "Seattle",
      country: "US",
    });

    const res = await route.POST(
      makeJsonRequest("http://localhost/api/v1/city-changes", "POST", {
        toCityId: "c3",
        effectiveMonth: effective.label,
      }),
    );

    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.error).toContain("暂不支持跨国家");
  });

  it("POST 校验生效月份需晚于当月", async () => {
    const route = await import("@/app/api/v1/city-changes/route");
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "u1",
      currentCityId: "c1",
      currentCity: { id: "c1", name: "杭州", country: "CN" },
    });
    mockPrisma.city.findUnique.mockResolvedValueOnce({
      id: "c2",
      name: "上海",
      country: "CN",
    });

    const now = new Date();
    const currentMonth = `${now.getUTCFullYear()}-${String(
      now.getUTCMonth() + 1,
    ).padStart(2, "0")}`;

    const res = await route.POST(
      makeJsonRequest("http://localhost/api/v1/city-changes", "POST", {
        toCityId: "c2",
        effectiveMonth: currentMonth,
      }),
    );

    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.error).toContain("effectiveMonth");
  });
});
