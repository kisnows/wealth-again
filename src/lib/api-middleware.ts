import { NextRequest, NextResponse } from "next/server";
import { ApiError, createErrorResponse } from "./api-utils";
import { logApiRequest, generateRequestId, createResponseTimeTracker } from "./api-logging";

// API 路由包装器 - 统一错误处理和响应格式
export function withApiHandler(
  handler: (req: NextRequest, context?: any) => Promise<NextResponse>,
  options: {
    requireAuth?: boolean;
    rateLimit?: {
      windowMs: number;
      maxRequests: number;
    };
    logRequests?: boolean;
  } = {}
) {
  return async (req: NextRequest, context?: any) => {
    const requestId = generateRequestId();
    const getResponseTime = createResponseTimeTracker();
    let userId: string | undefined;
    let statusCode = 200;

    try {
      // 添加请求ID到响应头
      const response = await handler(req, context);
      statusCode = response.status;
      
      response.headers.set('X-Request-ID', requestId);
      response.headers.set('X-Response-Time', `${getResponseTime()}ms`);
      
      // 记录请求日志（如果启用）
      if (options.logRequests) {
        await logApiRequest(req, userId, undefined, undefined, undefined, statusCode);
      }
      
      return response;

    } catch (error) {
      console.error('API Error:', error);
      
      // 处理不同类型的错误
      let apiError: ApiError;
      
      if (error instanceof ApiError) {
        apiError = error;
      } else if (error instanceof Error) {
        apiError = new ApiError(
          'INTERNAL_ERROR',
          process.env.NODE_ENV === 'production' 
            ? '服务器内部错误' 
            : error.message,
          500,
          process.env.NODE_ENV === 'development' ? error.stack : undefined
        );
      } else {
        apiError = new ApiError('INTERNAL_ERROR', '未知错误', 500);
      }

      statusCode = apiError.statusCode;
      
      // 记录错误日志
      if (options.logRequests) {
        await logApiRequest(req, userId, undefined, undefined, undefined, statusCode, apiError);
      }

      const { response, statusCode: errorStatusCode } = createErrorResponse(
        apiError.code,
        apiError.message,
        apiError.statusCode,
        apiError.details
      );

      const errorResponse = NextResponse.json(response, { status: errorStatusCode });
      errorResponse.headers.set('X-Request-ID', requestId);
      errorResponse.headers.set('X-Response-Time', `${getResponseTime()}ms`);
      
      return errorResponse;
    }
  };
}

// 添加安全头的中间件
export function addSecurityHeaders(response: NextResponse): NextResponse {
  // 安全响应头
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // CORS 头（如果需要）
  response.headers.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  response.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  
  return response;
}

// 简化的 API 包装器，用于快速创建标准化的 API 端点
export function createApiRoute(
  handler: (req: NextRequest, context?: any) => Promise<any>,
  options: {
    requireAuth?: boolean;
    logRequests?: boolean;
  } = {}
) {
  return withApiHandler(async (req: NextRequest, context?: any) => {
    const result = await handler(req, context);
    
    let response: NextResponse;
    
    if (result instanceof NextResponse) {
      response = result;
    } else {
      response = NextResponse.json(result);
    }
    
    return addSecurityHeaders(response);
  }, options);
}