import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

/**
 * 获取当前用户ID
 * 从NextAuth会话中提取用户ID
 * @param req - NextRequest对象（可选）
 * @returns 用户ID字符串
 * @throws 如果用户未登录或会话无效则抛出错误
 */
export async function getCurrentUser(req?: NextRequest) {
  // 在Next.js App Router的API路由中，getServerSession应该能自动获取会话
  // 如果遇到问题，我们可以尝试显式传递req和res对象
  const session = await getServerSession(authOptions);

  // 详细的调试信息
  console.log("getCurrentUser - session:", {
    exists: !!session,
    user: session?.user,
    userId: session?.user?.id,
  });

  if (!session?.user?.id) {
    // 记录调试信息
    console.log("No valid session found in getCurrentUser", session);
    throw new Error("Unauthorized: No valid session found");
  }

  return session.user.id;
}
