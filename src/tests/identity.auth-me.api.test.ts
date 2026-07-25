import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeJsonRequest } from "@/tests/helpers";
import { queueUpdateResults, resetDbMock } from "@/tests/helpers/dbMock";
import { ensureIdempotent } from "@/server/utils/idempotency";

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

vi.mock("@/server/utils/idempotency", () => ({
  ensureIdempotent: vi.fn().mockResolvedValue({ key: "idem-auth-1", existed: false }),
  markIdempotencyUsed: vi.fn(),
}));

describe("identity auth me API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMock();
  });

  it("PATCH 更新展示币种并记录审计", async () => {
    const route = await import("@/app/api/v1/identity/auth/me/route");
    queueUpdateResults([
      {
        id: "u1",
        email: "demo@example.com",
        name: "User",
        currentCityId: "c1",
        displayCurrency: "USD",
      },
    ]);
    const res = await route.PATCH(
      makeJsonRequest(
        "http://localhost/api/v1/identity/auth/me",
        "PATCH",
        { displayCurrency: "usd" },
        { "Idempotency-Key": "idem-auth-1" },
      ),
    );
    expect(res.status).toBe(200);
    expect(auditLogAndEmitMock).toHaveBeenCalledWith(
      "USER_DISPLAY_CURRENCY_UPDATE",
      expect.objectContaining({
        userId: "u1",
        meta: { displayCurrency: "USD" },
      }),
    );
  });

  it("PATCH 重复幂等键返回 409", async () => {
    const route = await import("@/app/api/v1/identity/auth/me/route");
    vi.mocked(ensureIdempotent).mockResolvedValueOnce({
      key: "idem-auth-dup",
      existed: true,
    });
    const res = await route.PATCH(
      makeJsonRequest(
        "http://localhost/api/v1/identity/auth/me",
        "PATCH",
        { displayCurrency: "USD" },
        { "Idempotency-Key": "idem-auth-dup" },
      ),
    );
    expect(res.status).toBe(409);
  });
});
