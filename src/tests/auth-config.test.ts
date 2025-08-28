import { describe, expect, it } from "vitest";
import { authOptions } from "@/lib/auth";

describe("auth config", () => {
  it("uses jwt session strategy", () => {
    expect(authOptions.session?.strategy).toBe("jwt");
  });

  it("has a secret configured", () => {
    // 顶层 secret 生效（我们在开发/测试提供了回退值）
    // @ts-expect-error - NextAuthOptions 未显式包含 secret，但运行时可用
    expect(authOptions.secret).toBeTruthy();
  });

  it("custom signIn page is /login", () => {
    expect(authOptions.pages?.signIn).toBe("/login");
  });
});
