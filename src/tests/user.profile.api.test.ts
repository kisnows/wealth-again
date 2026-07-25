import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeJsonRequest } from "@/tests/helpers";
import { queueUpdateResults, resetDbMock } from "@/tests/helpers/dbMock";
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
vi.mock("@/server/utils/idempotency", () => ({
  ensureIdempotent: vi.fn().mockResolvedValue({ key: "idem-profile", existed: false }),
  markIdempotencyUsed: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock();
});

describe("用户资料 API", () => {
  it("允许更新姓名", async () => {
    const route = await import("@/app/api/v1/identity/user/profile/route");
    queueUpdateResults([
      {
        id: "u1",
        email: "demo@example.com",
        currentCityId: "c1",
        name: "Tester",
        displayCurrency: "USD",
      },
    ]);

    const res = await route.PATCH(
      makeJsonRequest("http://localhost/api/v1/identity/user/profile", "PATCH", {
        name: "Tester",
      }),
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.name).toBe("Tester");
  });

  it("拒绝更新基础币种", async () => {
    const route = await import("@/app/api/v1/identity/user/profile/route");
    const res = await route.PATCH(
      makeJsonRequest("http://localhost/api/v1/identity/user/profile", "PATCH", {
        baseCurrency: "USD",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("拒绝通过资料接口修改城市", async () => {
    const route = await import("@/app/api/v1/identity/user/profile/route");

    const res = await route.PATCH(
      makeJsonRequest("http://localhost/api/v1/identity/user/profile", "PATCH", {
        currentCityId: "c2",
      }),
    );

    expect(res.status).toBe(400);
  });
});
