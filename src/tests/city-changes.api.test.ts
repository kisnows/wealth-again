import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeGet, makeJsonRequest } from "@/tests/helpers";
import {
  queueInsertResults,
  queueSelectResults,
  queueUpdateResults,
  resetDbMock,
} from "@/tests/helpers/dbMock";
const scheduleMock = vi.fn().mockResolvedValue("task-1");
vi.mock("@/server/utils/auth", () => ({
  getUserFromRequest: vi.fn().mockResolvedValue({ id: "u1" }),
}));
vi.mock("@/server/services/audit", () => ({
  logAudit: vi.fn(),
  audit: {
    log: vi.fn(),
    logAndEmit: vi.fn(),
  },
}));
vi.mock("@/server/services/income-tax/income", () => ({
  scheduleIncomeRecalcTask: scheduleMock,
}));
vi.mock("@/server/utils/idempotency", () => ({
  ensureIdempotent: vi.fn().mockResolvedValue({ key: "idem-city", existed: false }),
  markIdempotencyUsed: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock();
  scheduleMock.mockResolvedValue("task-1");
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
    const route = await import("@/app/api/v1/identity/city-changes/route");
    queueSelectResults(
      [{ id: "u1", currentCityId: "c1" }],
      [
        {
          id: "chg1",
          userId: "u1",
          toCityId: "c2",
          effectiveMonth: new Date("2025-04-01T00:00:00Z"),
          reason: null,
          createdAt: new Date("2025-03-10T02:00:00Z"),
          fromCityId: "c1",
        },
      ],
      [
        { id: "c1", name: "杭州", country: "CN" },
        { id: "c2", name: "上海", country: "CN" },
      ],
    );

    const res = await route.GET(
      makeGet("http://localhost/api/v1/identity/city-changes"),
    );
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.currentCity.name).toBe("杭州");
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].toCity.name).toBe("上海");
  });

  it("POST 成功创建迁移并排队回算任务", async () => {
    const route = await import("@/app/api/v1/identity/city-changes/route");
    const effective = futureMonth();
    queueSelectResults(
      [{ id: "u1", currentCityId: "c1" }],
      [{ id: "c2", name: "上海", country: "CN" }],
      [{ id: "c1", name: "杭州", country: "CN" }],
      [],
    );
    queueInsertResults([
      {
      id: "chg2",
      toCityId: "c2",
      effectiveMonth: new Date("2025-05-01T00:00:00Z"),
      fromCityId: "c1",
      createdAt: new Date(),
      },
    ]);
    queueUpdateResults({ changes: 1 });

    const res = await route.POST(
      makeJsonRequest("http://localhost/api/v1/identity/city-changes", "POST", {
        toCityId: "c2",
        effectiveMonth: effective.label,
      }),
    );

    expect(res.status).toBe(202);
    expect(scheduleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        taxYear: effective.year,
        startMonth: effective.month,
        cityId: "c2",
        endMonth: 12,
      }),
    );
    const payload = await res.json();
    expect(payload.task.id).toBe("task-1");
  });

  it("POST 拒绝跨国家城市迁移", async () => {
    const route = await import("@/app/api/v1/identity/city-changes/route");
    const effective = futureMonth();
    queueSelectResults(
      [{ id: "u1", currentCityId: "c1" }],
      [{ id: "c3", name: "Seattle", country: "US" }],
      [{ id: "c1", name: "杭州", country: "CN" }],
    );

    const res = await route.POST(
      makeJsonRequest("http://localhost/api/v1/identity/city-changes", "POST", {
        toCityId: "c3",
        effectiveMonth: effective.label,
      }),
    );

    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.error).toContain("暂不支持跨国家");
  });

  it("POST 校验生效月份需晚于当月", async () => {
    const route = await import("@/app/api/v1/identity/city-changes/route");
    queueSelectResults(
      [{ id: "u1", currentCityId: "c1" }],
      [{ id: "c2", name: "上海", country: "CN" }],
      [{ id: "c1", name: "杭州", country: "CN" }],
    );

    const now = new Date();
    const currentMonth = `${now.getUTCFullYear()}-${String(
      now.getUTCMonth() + 1,
    ).padStart(2, "0")}`;

    const res = await route.POST(
      makeJsonRequest("http://localhost/api/v1/identity/city-changes", "POST", {
        toCityId: "c2",
        effectiveMonth: currentMonth,
      }),
    );

    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.error).toContain("effectiveMonth");
  });
});
