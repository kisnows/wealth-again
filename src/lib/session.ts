import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { NextRequest } from "next/server";

export async function getCurrentUser() {
  // 在Next.js App Router的API路由中，getServerSession应该能自动获取会话
  // 如果遇到问题，我们可以尝试显式传递req和res对象
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    // 记录调试信息
    console.log("No valid session found in getCurrentUser", session);
    throw new Error("Unauthorized: No valid session found");
  }
  
  return session.user.id;
}