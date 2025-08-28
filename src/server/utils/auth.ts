import type { NextRequest } from "next/server";

export async function getUserFromRequest(_req?: NextRequest) {
  // 在测试环境下，绕过 NextAuth，直接返回一个虚拟用户，避免引入 next/server 依赖与会话环境
  if (process.env.VITEST || process.env.NODE_ENV === "test") {
    return { id: "u1", email: "test@example.com", name: "Tester" } as any;
  }
  const { auth } = await import("@/server/auth");
  const session = await auth();
  return session?.user ?? null;
}
