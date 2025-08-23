import type { NextRequest } from "next/server";
import { prisma } from "./prisma";

// 请求日志记录
export async function logApiRequest(
  req: NextRequest,
  userId?: string,
  action?: string,
  resource?: string,
  resourceId?: string,
  statusCode?: number,
  error?: any,
) {
  try {
    const userAgent = req.headers.get("user-agent") || undefined;
    const ipAddress =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      (req as any).ip ||
      undefined;

    // 只记录重要的操作和错误
    const shouldLog = statusCode !== 200 || ["POST", "PUT", "DELETE"].includes(req.method) || error;

    if (shouldLog) {
      await prisma.auditLog.create({
        data: {
          userId,
          action: action || req.method,
          resource: resource || req.nextUrl.pathname,
          resourceId,
          oldValues: error ? JSON.stringify({ error: error.message }) : undefined,
          newValues: statusCode ? JSON.stringify({ statusCode }) : undefined,
          ipAddress,
          userAgent,
        },
      });
    }
  } catch (logError) {
    // 记录日志失败不应该影响主要业务流程
    console.error("Failed to log API request:", logError);
  }
}

// 获取客户端IP地址
export function getClientIP(req: NextRequest): string | undefined {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0] ||
    req.headers.get("x-real-ip") ||
    (req as any).ip
  );
}

// 获取用户代理信息
export function getUserAgent(req: NextRequest): string | undefined {
  return req.headers.get("user-agent") || undefined;
}

// 生成请求ID
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 计算响应时间
export function createResponseTimeTracker() {
  const startTime = Date.now();
  return () => Date.now() - startTime;
}
