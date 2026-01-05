import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeJsonRequest } from "@/tests/helpers";
import { queueSelectResults, resetDbMock } from "@/tests/helpers/dbMock";

const logAuditMock = vi.fn().mockResolvedValue(undefined);
const signUpEmailMock = vi.fn();

vi.mock("@/server/services/audit", () => ({
  logAudit: logAuditMock,
}));

vi.mock("@/server/auth", () => ({
  auth: {
    api: {
      signUpEmail: signUpEmailMock,
    },
  },
}));
vi.mock("@/server/utils/idempotency", () => ({
  ensureIdempotent: vi.fn().mockResolvedValue({ key: "idem-register-1", existed: false }),
  markIdempotencyUsed: vi.fn(),
}));

// 描述：注册接口场景验证
describe("identity register API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMock();
    signUpEmailMock.mockImplementation(async ({ body }: { body: any }) => ({
      user: {
        id: "new-user",
        email: body.email,
        name: body.name,
        currentCityId: body.currentCityId,
        displayCurrency: body.displayCurrency,
      },
    }));
  });

  // 场景：成功注册新用户
  it("POST 创建新用户并记录审计日志", async () => {
    const route = await import("@/app/api/v1/identity/register/route");
    queueSelectResults([{ id: "city-1" }], []);
    const res = await route.POST(
      makeJsonRequest(
        "http://localhost/api/v1/identity/register",
        "POST",
        {
          email: "new@example.com",
          password: "P@ssword123",
          name: "新人",
          cityId: "city-1",
          displayCurrency: "CNY",
        },
        { "Idempotency-Key": "idem-register-1" },
      ),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      id: "new-user",
      email: "new@example.com",
      currentCityId: "city-1",
      displayCurrency: "CNY",
    });
    expect(signUpEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          email: "new@example.com",
          password: "P@ssword123",
          currentCityId: "city-1",
          displayCurrency: "CNY",
        }),
      }),
    );
    expect(logAuditMock).toHaveBeenCalledWith(
      "USER_REGISTER",
      expect.objectContaining({
        userId: "new-user",
        meta: expect.objectContaining({ email: "new@example.com" }),
      }),
    );
  });

  // 场景：邮箱重复注册
  it("POST 邮箱已存在返回 409", async () => {
    const route = await import("@/app/api/v1/identity/register/route");
    queueSelectResults([{ id: "city-1" }], [{ id: "existing-user" }]);
    const res = await route.POST(
      makeJsonRequest(
        "http://localhost/api/v1/identity/register",
        "POST",
        {
          email: "new@example.com",
          password: "P@ssword123",
          cityId: "city-1",
        },
        { "Idempotency-Key": "idem-register-dup" },
      ),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toMatchObject({ error: "email_conflict" });
    expect(signUpEmailMock).not.toHaveBeenCalled();
  });

  // 场景：展示币种不支持
  it("POST 展示币种不受支持返回 422", async () => {
    const route = await import("@/app/api/v1/identity/register/route");
    const res = await route.POST(
      makeJsonRequest(
        "http://localhost/api/v1/identity/register",
        "POST",
        {
          email: "new@example.com",
          password: "P@ssword123",
          cityId: "city-1",
          displayCurrency: "GBP",
        },
        { "Idempotency-Key": "idem-register-2" },
      ),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body).toMatchObject({ error: "display_currency_not_supported" });
    expect(signUpEmailMock).not.toHaveBeenCalled();
  });
});
