import type { NextRequest } from "next/server";

export type AuthenticatedUser = {
  id: string;
  email?: string | null;
  name?: string | null;
};

export async function getUserFromRequest(
  _req?: NextRequest | Request,
): Promise<AuthenticatedUser | null> {
  // 在测试环境下，绕过 NextAuth，直接返回一个虚拟用户，避免引入 next/server 依赖与会话环境
  if (process.env.VITEST || process.env.NODE_ENV === "test") {
    return { id: "u1", email: "test@example.com", name: "Tester" };
  }
  const { auth } = await import("@/server/auth");
  const session = await auth();
  if (!session?.user?.id) return null;
  const { id, email = null, name = null } = session.user;
  return { id, email, name } satisfies AuthenticatedUser;
}
