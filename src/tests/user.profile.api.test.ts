import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeJsonRequest } from "@/tests/helpers";

const mockPrisma: any = {
  user: { update: vi.fn() },
};

vi.mock("@/server/db", () => ({ default: mockPrisma }));
vi.mock("@/server/utils/auth", () => ({
  getUserFromRequest: vi.fn().mockResolvedValue({ id: "u1" }),
}));
vi.mock("@/server/services/audit", () => ({ logAudit: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("用户资料 API", () => {
  it("允许更新基础币种", async () => {
    const route = await import("@/app/api/v1/user/profile/route");
    mockPrisma.user.update.mockResolvedValueOnce({
      id: "u1",
      email: "demo@example.com",
      baseCurrency: "USD",
      currentCityId: "c1",
    });

    const res = await route.PATCH(
      makeJsonRequest("http://localhost/api/v1/user/profile", "PATCH", {
        baseCurrency: "USD",
      }),
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.baseCurrency).toBe("USD");
    expect(mockPrisma.user.update).toHaveBeenCalled();
  });

  it("拒绝通过资料接口修改城市", async () => {
    const route = await import("@/app/api/v1/user/profile/route");

    const res = await route.PATCH(
      makeJsonRequest("http://localhost/api/v1/user/profile", "PATCH", {
        currentCityId: "c2",
      }),
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});
