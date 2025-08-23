import type { NextRequest } from "next/server";
import { RateLimitError } from "./errors";
import { logSecurityEvent } from "./logger";

// 速率限制配置
interface RateLimitConfig {
  windowMs: number; // 时间窗口（毫秒）
  maxRequests: number; // 最大请求数
  skipSuccessfulRequests?: boolean; // 是否跳过成功的请求
  skipFailedRequests?: boolean; // 是否跳过失败的请求
  keyGenerator?: (req: NextRequest) => string; // 自定义键生成器
}

// 内存存储（生产环境建议使用 Redis）
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// 清理过期的限制记录
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // 每分钟清理一次

// 速率限制中间件
export function rateLimit(config: RateLimitConfig) {
  return async (req: NextRequest, userId?: string) => {
    const key = config.keyGenerator ? config.keyGenerator(req) : getDefaultKey(req, userId);

    const now = Date.now();
    const record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      // 创建新记录
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + config.windowMs,
      });
      return;
    }

    if (record.count >= config.maxRequests) {
      // 记录安全事件
      await logSecurityEvent(
        "RATE_LIMIT_EXCEEDED",
        "MEDIUM",
        `Rate limit exceeded for key: ${key}`,
        userId,
        req,
        { limit: config.maxRequests, window: config.windowMs },
      );

      throw new RateLimitError(config.maxRequests, config.windowMs);
    }

    // 增加计数
    record.count++;
  };
}

// 默认键生成器
function getDefaultKey(req: NextRequest, userId?: string): string {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  return userId ? `user:${userId}` : `ip:${ip}`;
}

// 预设的速率限制配置
export const rateLimitConfigs = {
  // 严格限制（登录、注册等敏感操作）
  strict: {
    windowMs: 15 * 60 * 1000, // 15分钟
    maxRequests: 5,
  },

  // 中等限制（一般API操作）
  moderate: {
    windowMs: 60 * 1000, // 1分钟
    maxRequests: 60,
  },

  // 宽松限制（读取操作）
  lenient: {
    windowMs: 60 * 1000, // 1分钟
    maxRequests: 100,
  },
};

// 输入清理和验证
export function sanitizeInput(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "") // 移除script标签
    .replace(/javascript:/gi, "") // 移除javascript:协议
    .replace(/on\w+\s*=/gi, "") // 移除事件处理器
    .trim();
}

// SQL注入防护（Prisma已经提供了保护，这里是额外的验证）
export function validateSqlSafeString(input: string): boolean {
  const dangerousPatterns = [
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
    /(--|#|\/\*|\*\/)/,
    /(\bor\b|\band\b).*=.*=/i,
  ];

  return !dangerousPatterns.some((pattern) => pattern.test(input));
}

// XSS防护
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 敏感数据脱敏
export function maskSensitiveData(data: any): any {
  if (typeof data === "string") {
    // 邮箱脱敏
    if (data.includes("@")) {
      const [local, domain] = data.split("@");
      return `${local.substring(0, 2)}***@${domain}`;
    }
    // 手机号脱敏
    if (/^\d{11}$/.test(data)) {
      return data.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");
    }
    // 身份证号脱敏
    if (/^\d{15}$|^\d{18}$/.test(data)) {
      return data.replace(/(\d{6})\d{8}(\d{4})/, "$1********$2");
    }
  }

  if (typeof data === "object" && data !== null) {
    const masked = { ...data };

    // 脱敏常见的敏感字段
    const sensitiveFields = ["password", "token", "secret", "key", "ssn", "creditCard"];

    for (const field of sensitiveFields) {
      if (field in masked) {
        masked[field] = "***";
      }
    }

    return masked;
  }

  return data;
}

// JWT令牌验证（增强安全性）
export function validateJwtStructure(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  try {
    // 验证是否是有效的base64编码
    atob(parts[0].replace(/-/g, "+").replace(/_/g, "/"));
    atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return true;
  } catch {
    return false;
  }
}

// 安全头设置
export function getSecurityHeaders(): Record<string, string> {
  return {
    // 防止点击劫持
    "X-Frame-Options": "DENY",

    // 防止内容类型嗅探
    "X-Content-Type-Options": "nosniff",

    // XSS保护
    "X-XSS-Protection": "1; mode=block",

    // 引用者政策
    "Referrer-Policy": "strict-origin-when-cross-origin",

    // 内容安全策略
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self'",
      "font-src 'self'",
      "object-src 'none'",
      "media-src 'self'",
      "frame-src 'none'",
    ].join("; "),

    // HTTPS传输安全
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",

    // 权限策略
    "Permissions-Policy": [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "interest-cohort=()",
    ].join(", "),
  };
}

// IP白名单验证
export function isIpAllowed(ip: string, whitelist?: string[]): boolean {
  if (!whitelist || whitelist.length === 0) return true;

  return whitelist.some((allowedIp) => {
    if (allowedIp.includes("/")) {
      // CIDR notation support
      return isIpInCidr(ip, allowedIp);
    }
    return ip === allowedIp;
  });
}

// CIDR网段检查
function isIpInCidr(ip: string, cidr: string): boolean {
  // 简化的CIDR检查，生产环境建议使用专业库
  const [network, prefixLength] = cidr.split("/");
  const ipParts = ip.split(".").map(Number);
  const networkParts = network.split(".").map(Number);
  const prefix = parseInt(prefixLength, 10);

  let mask = 0;
  for (let i = 0; i < prefix; i++) {
    mask |= 1 << (31 - i);
  }

  const ipNum = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
  const networkNum =
    (networkParts[0] << 24) | (networkParts[1] << 16) | (networkParts[2] << 8) | networkParts[3];

  return (ipNum & mask) === (networkNum & mask);
}

// 恶意请求检测
export function detectMaliciousRequest(req: NextRequest): {
  isMalicious: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  const url = req.url;
  const userAgent = req.headers.get("user-agent") || "";

  // 检测常见的攻击模式
  const maliciousPatterns = [
    { pattern: /\.\.\//g, reason: "Path traversal attempt" },
    { pattern: /<script/i, reason: "XSS attempt" },
    { pattern: /union.*select/i, reason: "SQL injection attempt" },
    { pattern: /javascript:/i, reason: "JavaScript injection attempt" },
    { pattern: /php:/i, reason: "PHP filter attempt" },
  ];

  for (const { pattern, reason } of maliciousPatterns) {
    if (pattern.test(url)) {
      reasons.push(reason);
    }
  }

  // 检测可疑的User-Agent
  if (!userAgent || userAgent.length < 10) {
    reasons.push("Suspicious or missing User-Agent");
  }

  // 检测过长的URL
  if (url.length > 2000) {
    reasons.push("Unusually long URL");
  }

  return {
    isMalicious: reasons.length > 0,
    reasons,
  };
}

// 会话安全检查
export function validateSessionSecurity(
  sessionToken: string,
  ipAddress: string,
  userAgent: string,
  lastKnownIp?: string,
  lastKnownUserAgent?: string,
): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // IP变化检查
  if (lastKnownIp && lastKnownIp !== ipAddress) {
    warnings.push("IP address changed");
  }

  // User-Agent变化检查
  if (lastKnownUserAgent && lastKnownUserAgent !== userAgent) {
    warnings.push("User-Agent changed");
  }

  // 令牌格式检查
  if (!validateJwtStructure(sessionToken)) {
    return { isValid: false, warnings: ["Invalid token structure"] };
  }

  return {
    isValid: warnings.length < 2, // 允许最多一个警告
    warnings,
  };
}
