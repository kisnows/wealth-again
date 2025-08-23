// 错误类型定义
export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export enum ErrorCategory {
  VALIDATION = "validation",
  AUTHENTICATION = "authentication",
  AUTHORIZATION = "authorization",
  DATABASE = "database",
  EXTERNAL_API = "external_api",
  BUSINESS_LOGIC = "business_logic",
  SYSTEM = "system",
  NETWORK = "network",
}

// 基础错误类
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly severity: ErrorSeverity;
  public readonly category: ErrorCategory;
  public readonly context?: Record<string, any>;
  public readonly userMessage?: string;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    category: ErrorCategory = ErrorCategory.SYSTEM,
    context?: Record<string, any>,
    userMessage?: string,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.severity = severity;
    this.category = category;
    this.context = context;
    this.userMessage = userMessage;
    this.timestamp = new Date();

    // 确保堆栈跟踪正确
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  // 转换为客户端安全的格式
  toClientSafe() {
    return {
      code: this.code,
      message: this.userMessage || "服务暂时不可用，请稍后重试",
      severity: this.severity,
      timestamp: this.timestamp.toISOString(),
    };
  }

  // 转换为日志格式
  toLogFormat() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      severity: this.severity,
      category: this.category,
      context: this.context,
      stack: this.stack,
      timestamp: this.timestamp.toISOString(),
    };
  }
}

// 特定错误类型
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(
      message,
      "VALIDATION_ERROR",
      400,
      ErrorSeverity.LOW,
      ErrorCategory.VALIDATION,
      context,
      "输入数据不符合要求，请检查后重试",
    );
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "身份验证失败") {
    super(
      message,
      "AUTHENTICATION_ERROR",
      401,
      ErrorSeverity.MEDIUM,
      ErrorCategory.AUTHENTICATION,
      undefined,
      "请先登录",
    );
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = "权限不足") {
    super(
      message,
      "AUTHORIZATION_ERROR",
      403,
      ErrorSeverity.MEDIUM,
      ErrorCategory.AUTHORIZATION,
      undefined,
      "您没有权限执行此操作",
    );
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = "资源") {
    super(
      `${resource}不存在`,
      "NOT_FOUND",
      404,
      ErrorSeverity.LOW,
      ErrorCategory.BUSINESS_LOGIC,
      { resource },
      `请求的${resource}不存在`,
    );
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(
      message,
      "CONFLICT_ERROR",
      409,
      ErrorSeverity.MEDIUM,
      ErrorCategory.BUSINESS_LOGIC,
      context,
      "操作冲突，请检查数据后重试",
    );
    this.name = "ConflictError";
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(
      message,
      "DATABASE_ERROR",
      500,
      ErrorSeverity.HIGH,
      ErrorCategory.DATABASE,
      { originalError: originalError?.message },
      "数据操作失败，请稍后重试",
    );
    this.name = "DatabaseError";
  }
}

export class ExternalApiError extends AppError {
  constructor(service: string, message: string, statusCode?: number) {
    super(
      `External API error from ${service}: ${message}`,
      "EXTERNAL_API_ERROR",
      statusCode || 502,
      ErrorSeverity.HIGH,
      ErrorCategory.EXTERNAL_API,
      { service, statusCode },
      "外部服务暂时不可用，请稍后重试",
    );
    this.name = "ExternalApiError";
  }
}

export class RateLimitError extends AppError {
  constructor(limit: number, windowMs: number) {
    super(
      `Rate limit exceeded: ${limit} requests per ${windowMs}ms`,
      "RATE_LIMIT_ERROR",
      429,
      ErrorSeverity.MEDIUM,
      ErrorCategory.SYSTEM,
      { limit, windowMs },
      "请求过于频繁，请稍后重试",
    );
    this.name = "RateLimitError";
  }
}

// 错误工厂函数
export const ErrorFactory = {
  validation: (message: string, context?: Record<string, any>) =>
    new ValidationError(message, context),

  authentication: (message?: string) => new AuthenticationError(message),

  authorization: (message?: string) => new AuthorizationError(message),

  notFound: (resource?: string) => new NotFoundError(resource),

  conflict: (message: string, context?: Record<string, any>) => new ConflictError(message, context),

  database: (message: string, originalError?: Error) => new DatabaseError(message, originalError),

  externalApi: (service: string, message: string, statusCode?: number) =>
    new ExternalApiError(service, message, statusCode),

  rateLimit: (limit: number, windowMs: number) => new RateLimitError(limit, windowMs),
};

// 错误处理工具函数
export function isAppError(error: any): error is AppError {
  return error instanceof AppError;
}

export function getErrorCode(error: any): string {
  if (isAppError(error)) {
    return error.code;
  }
  if (error instanceof Error) {
    return "UNKNOWN_ERROR";
  }
  return "INVALID_ERROR";
}

export function getErrorMessage(error: any): string {
  if (isAppError(error)) {
    return error.userMessage || error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error occurred";
}

export function getErrorSeverity(error: any): ErrorSeverity {
  if (isAppError(error)) {
    return error.severity;
  }
  return ErrorSeverity.MEDIUM;
}

// 错误上下文收集
export function collectErrorContext(req?: any): Record<string, any> {
  const context: Record<string, any> = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    environment: process.env.NODE_ENV,
  };

  if (req) {
    context.request = {
      method: req.method,
      url: req.url,
      userAgent: req.headers?.["user-agent"],
      ip: req.headers?.["x-forwarded-for"] || req.headers?.["x-real-ip"] || req.ip,
      referer: req.headers?.referer,
    };
  }

  return context;
}
