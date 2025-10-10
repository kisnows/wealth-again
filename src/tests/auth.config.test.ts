import { describe, expect, it } from "vitest";
import { authOptions } from "@/lib/auth";

describe("auth config", () => {
  it("uses jwt session strategy", () => {
    // 用例：配置需启用 JWT 会话模式，以支持无状态 API。
    expect(authOptions.session?.strategy).toBe("jwt");
  });

  it("has a secret configured", () => {
    // 顶层 secret 生效（我们在开发/测试提供了回退值）
    // @ts-expect-error - NextAuthOptions 未显式包含 secret，但运行时可用
    expect(authOptions.secret).toBeTruthy();
  });

  it("custom signIn page is /login", () => {
    // 用例：登录页应指向自定义路由 /login，确保 UI 与配置保持一致。
    expect(authOptions.pages?.signIn).toBe("/login");
  });
});
