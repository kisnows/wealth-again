import { NextRequest } from 'next/server';
import { prisma } from './prisma';
import { AppError, ErrorSeverity, ErrorCategory, collectErrorContext } from './errors';

// 日志级别
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

// 日志接口
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, any>;
  error?: any;
  userId?: string;
  requestId?: string;
  sessionId?: string;
}

// 结构化日志记录器
class Logger {
  private context: Record<string, any> = {};

  constructor(defaultContext?: Record<string, any>) {
    this.context = defaultContext || {};
  }

  // 创建子日志记录器
  child(context: Record<string, any>): Logger {
    return new Logger({ ...this.context, ...context });
  }

  // 核心日志方法
  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: any) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context: { ...this.context, ...context },
      error: error ? this.sanitizeError(error) : undefined,
    };

    // 控制台输出
    this.logToConsole(entry);

    // 生产环境下可以发送到外部日志服务
    if (process.env.NODE_ENV === 'production') {
      this.logToExternalService(entry).catch(console.error);
    }

    // 错误级别以上的日志写入数据库
    if (level === LogLevel.ERROR || level === LogLevel.FATAL) {
      this.logToDatabase(entry).catch(console.error);
    }
  }

  debug(message: string, context?: Record<string, any>) {
    if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
      this.log(LogLevel.DEBUG, message, context);
    }
  }

  info(message: string, context?: Record<string, any>) {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, any>) {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: any, context?: Record<string, any>) {
    this.log(LogLevel.ERROR, message, context, error);
  }

  fatal(message: string, error?: any, context?: Record<string, any>) {
    this.log(LogLevel.FATAL, message, context, error);
  }

  // 清理错误对象，移除敏感信息
  private sanitizeError(error: any) {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        code: (error as any).code,
        statusCode: (error as any).statusCode,
      };
    }
    return error;
  }

  // 控制台输出
  private logToConsole(entry: LogEntry) {
    const { level, message, timestamp, context, error } = entry;
    const prefix = `[${timestamp.toISOString()}] ${level.toUpperCase()}:`;
    
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(prefix, message, context, error);
        break;
      case LogLevel.INFO:
        console.info(prefix, message, context);
        break;
      case LogLevel.WARN:
        console.warn(prefix, message, context);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(prefix, message, context, error);
        break;
    }
  }

  // 写入数据库（用于审计和错误追踪）
  private async logToDatabase(entry: LogEntry) {
    try {
      await prisma.auditLog.create({
        data: {
          userId: entry.context?.userId,
          action: 'LOG',
          resource: 'SYSTEM',
          resourceId: entry.requestId,
          newValues: JSON.stringify({
            level: entry.level,
            message: entry.message,
            context: entry.context,
            error: entry.error,
          }),
          ipAddress: entry.context?.request?.ip,
          userAgent: entry.context?.request?.userAgent,
        },
      });
    } catch (error) {
      console.error('Failed to write log to database:', error);
    }
  }

  // 发送到外部日志服务（如 Datadog, Sentry 等）
  private async logToExternalService(entry: LogEntry) {
    // 这里可以集成外部日志服务
    // 例如：
    // if (process.env.SENTRY_DSN) {
    //   Sentry.captureMessage(entry.message, entry.level as any);
    // }
    // 
    // if (process.env.DATADOG_API_KEY) {
    //   await sendToDatadog(entry);
    // }
  }
}

// 全局日志实例
export const logger = new Logger();

// 请求日志中间件
export async function logRequest(
  req: NextRequest,
  response: any,
  userId?: string,
  duration?: number
) {
  const requestLogger = logger.child({
    requestId: req.headers.get('x-request-id'),
    userId,
    request: {
      method: req.method,
      url: req.url,
      userAgent: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
    },
    response: {
      statusCode: response?.status,
      duration,
    },
  });

  const message = `${req.method} ${req.url} - ${response?.status || 'UNKNOWN'}`;

  if (response?.status >= 500) {
    requestLogger.error(message);
  } else if (response?.status >= 400) {
    requestLogger.warn(message);
  } else {
    requestLogger.info(message);
  }
}

// API 错误日志记录
export async function logApiError(
  error: any,
  req?: NextRequest,
  userId?: string,
  context?: Record<string, any>
) {
  const errorContext = {
    ...collectErrorContext(req),
    ...context,
    userId,
  };

  if (error instanceof AppError) {
    const errorLogger = logger.child(errorContext);
    
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        errorLogger.fatal(error.message, error);
        break;
      case ErrorSeverity.HIGH:
        errorLogger.error(error.message, error);
        break;
      case ErrorSeverity.MEDIUM:
        errorLogger.warn(error.message, error);
        break;
      case ErrorSeverity.LOW:
        errorLogger.info(error.message, error);
        break;
    }
  } else {
    logger.error('Unhandled error', error, errorContext);
  }
}

// 业务操作日志记录
export async function logBusinessOperation(
  userId: string,
  operation: string,
  resource: string,
  resourceId?: string,
  oldValues?: any,
  newValues?: any,
  req?: NextRequest
) {
  try {
    const context = collectErrorContext(req);
    
    await prisma.auditLog.create({
      data: {
        userId,
        action: operation,
        resource,
        resourceId,
        oldValues: oldValues ? JSON.stringify(oldValues) : undefined,
        newValues: newValues ? JSON.stringify(newValues) : undefined,
        ipAddress: context.request?.ip,
        userAgent: context.request?.userAgent,
      },
    });

    logger.info(`Business operation: ${operation} on ${resource}`, {
      userId,
      operation,
      resource,
      resourceId,
    });
  } catch (error) {
    logger.error('Failed to log business operation', error);
  }
}

// 性能监控日志
export function logPerformance(
  operation: string,
  duration: number,
  context?: Record<string, any>
) {
  const perfLogger = logger.child({
    performance: {
      operation,
      duration,
      timestamp: new Date().toISOString(),
    },
    ...context,
  });

  if (duration > 5000) { // 超过 5 秒的操作
    perfLogger.warn(`Slow operation detected: ${operation} took ${duration}ms`);
  } else if (duration > 1000) { // 超过 1 秒的操作
    perfLogger.info(`Operation ${operation} took ${duration}ms`);
  } else {
    perfLogger.debug(`Operation ${operation} took ${duration}ms`);
  }
}

// 用户行为日志
export async function logUserAction(
  userId: string,
  action: string,
  details?: Record<string, any>,
  req?: NextRequest
) {
  const context = {
    userId,
    action,
    details,
    ...collectErrorContext(req),
  };

  logger.info(`User action: ${action}`, context);

  // 记录到数据库以便分析用户行为
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'USER_ACTION',
        resource: action,
        newValues: JSON.stringify(details),
        ipAddress: context.request?.ip,
        userAgent: context.request?.userAgent,
      },
    });
  } catch (error) {
    logger.error('Failed to log user action', error);
  }
}

// 安全事件日志
export async function logSecurityEvent(
  eventType: string,
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  message: string,
  userId?: string,
  req?: NextRequest,
  details?: Record<string, any>
) {
  const context = {
    securityEvent: {
      type: eventType,
      severity,
      userId,
      details,
    },
    ...collectErrorContext(req),
  };

  const securityLogger = logger.child(context);

  switch (severity) {
    case 'CRITICAL':
      securityLogger.fatal(`Security Event: ${message}`);
      break;
    case 'HIGH':
      securityLogger.error(`Security Event: ${message}`);
      break;
    case 'MEDIUM':
      securityLogger.warn(`Security Event: ${message}`);
      break;
    case 'LOW':
      securityLogger.info(`Security Event: ${message}`);
      break;
  }

  // 安全事件应该立即记录到数据库
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'SECURITY_EVENT',
        resource: eventType,
        newValues: JSON.stringify({
          severity,
          message,
          details,
        }),
        ipAddress: context.request?.ip,
        userAgent: context.request?.userAgent,
      },
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

// 创建带有特定上下文的日志记录器
export function createLogger(context: Record<string, any>): Logger {
  return new Logger(context);
}

// 日志查询辅助函数（用于管理界面）
export async function getAuditLogs(
  filters: {
    userId?: string;
    action?: string;
    resource?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    pageSize?: number;
  } = {}
) {
  const {
    userId,
    action,
    resource,
    startDate,
    endDate,
    page = 1,
    pageSize = 20,
  } = filters;

  const where: any = {};
  
  if (userId) where.userId = userId;
  if (action) where.action = { contains: action };
  if (resource) where.resource = { contains: resource };
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: {
          select: { email: true, name: true }
        }
      }
    }),
  ]);

  return {
    logs,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}