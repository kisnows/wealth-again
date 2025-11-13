import { describe, expect, it, vi } from "vitest";

vi.mock("better-auth/next-js", () => ({
  nextCookies: () => ({ id: "test-next-cookies", hooks: { after: [] } }),
  toNextJsHandler: () => ({ GET: vi.fn(), POST: vi.fn() }),
}));

const { auth } = await import("@/server/auth");

describe("auth config", () => {
  it("enables credential login without auto sign-in", () => {
    expect(auth.options.emailAndPassword?.enabled).toBe(true);
    expect(auth.options.emailAndPassword?.autoSignIn).toBe(false);
  });

  it("maps custom user fields", () => {
    const fields = auth.options.user?.additionalFields;
    expect(fields?.currentCityId?.required).toBe(true);
    expect(fields?.displayCurrency).toBeDefined();
  });

  it("uses dedicated auth tables to avoid clashes", () => {
    expect(auth.options.session?.modelName).toBe("authSession");
    expect(auth.options.account?.modelName).toBe("authAccount");
  });
});
