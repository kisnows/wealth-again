import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeJsonRequest } from "@/tests/helpers";
import { prismaMock, resetPrismaMock } from "@/tests/helpers/prismaMock";

const mockPrisma = prismaMock;

vi.mock("@/server/utils/auth", () => ({
  getUserFromRequest: vi.fn().mockResolvedValue({ id: "u1" }),
}));

const auditLogAndEmitMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/server/services/audit", () => ({
  audit: {
    log: vi.fn(),
    logAndEmit: auditLogAndEmitMock,
  },
  logAudit: vi.fn(),
}));

describe("identity auth me API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPrismaMock();
    mockPrisma.user.update.mockResolvedValue({
      id: "u1",
      email: "demo@example.com",
      name: "User",
      currentCityId: "c1",
      displayCurrency: "USD",
    });
  });

  it("PATCH 更新展示币种并记录审计", async () => {
    const route = await import("@/app/api/v1/identity/auth/me/route");
    const res = await route.PATCH(
      makeJsonRequest(
        "http://localhost/api/v1/identity/auth/me",
        "PATCH",
        { displayCurrency: "usd" },
        { "Idempotency-Key": "idem-auth-1" },
      ),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { displayCurrency: "USD" },
      }),
    );
    expect(auditLogAndEmitMock).toHaveBeenCalledWith(
      "USER_DISPLAY_CURRENCY_UPDATE",
      expect.objectContaining({
        userId: "u1",
        meta: { displayCurrency: "USD" },
      }),
    );
    expect(mockPrisma.idempotencyKey.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ key: "idem-auth-1" }) }),
    );
    expect(mockPrisma.idempotencyKey.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: "idem-auth-1" } }),
    );
  });

  it("PATCH 重复幂等键返回 409", async () => {
    const route = await import("@/app/api/v1/identity/auth/me/route");
    mockPrisma.idempotencyKey.findUnique
      .mockResolvedValueOnce({ key: "idem-auth-dup" } as any);
    const res = await route.PATCH(
      makeJsonRequest(
        "http://localhost/api/v1/identity/auth/me",
        "PATCH",
        { displayCurrency: "USD" },
        { "Idempotency-Key": "idem-auth-dup" },
      ),
    );
    expect(res.status).toBe(409);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});
