import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeJsonRequest } from "@/tests/helpers";
import { prismaMock, resetPrismaMock } from "@/tests/helpers/prismaMock";

const mockPrisma = prismaMock;
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

beforeEach(() => {
  vi.clearAllMocks();
  resetPrismaMock();
});

describe("用户资料 API", () => {
  it("允许更新姓名", async () => {
    const route = await import("@/app/api/v1/identity/user/profile/route");
    mockPrisma.user.update.mockResolvedValueOnce({
      id: "u1",
      email: "demo@example.com",
      currentCityId: "c1",
      name: "Tester",
      displayCurrency: "USD",
    });

    const res = await route.PATCH(
      makeJsonRequest("http://localhost/api/v1/identity/user/profile", "PATCH", {
        name: "Tester",
      }),
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.name).toBe("Tester");
    expect(mockPrisma.user.update).toHaveBeenCalled();
  });

  it("拒绝更新基础币种", async () => {
    const route = await import("@/app/api/v1/identity/user/profile/route");
    const res = await route.PATCH(
      makeJsonRequest("http://localhost/api/v1/identity/user/profile", "PATCH", {
        baseCurrency: "USD",
      }),
    );
    expect(res.status).toBe(400);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("拒绝通过资料接口修改城市", async () => {
    const route = await import("@/app/api/v1/identity/user/profile/route");

    const res = await route.PATCH(
      makeJsonRequest("http://localhost/api/v1/identity/user/profile", "PATCH", {
        currentCityId: "c2",
      }),
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});
