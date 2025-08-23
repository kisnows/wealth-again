import { type NextRequest, NextResponse } from "next/server";
import { ZodError, type z } from "zod";
import { getCurrentUser } from "@/lib/session";

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiContext {
  userId: string;
  req: NextRequest;
}

export type ApiHandler<T = any> = (context: ApiContext, params?: any) => Promise<ApiResponse<T>>;

/**
 * 统一的API处理器包装器
 * 提供认证、错误处理、响应格式化等通用功能
 */
export function withApiHandler<T = any>(handler: ApiHandler<T>) {
  return async (req: NextRequest, params?: any): Promise<NextResponse> => {
    try {
      // 统一的用户认证
      const userId = await getCurrentUser(req);

      // 执行业务逻辑
      const result = await handler({ userId, req }, params);

      // 统一的响应格式
      return NextResponse.json(result, {
        status: result.success ? 200 : 400,
      });
    } catch (error) {
      return handleApiError(error);
    }
  };
}

/**
 * 不需要认证的API处理器
 */
export function withPublicApiHandler<T = any>(
  handler: (req: NextRequest, params?: any) => Promise<ApiResponse<T>>,
) {
  return async (req: NextRequest, params?: any): Promise<NextResponse> => {
    try {
      const result = await handler(req, params);
      return NextResponse.json(result, {
        status: result.success ? 200 : 400,
      });
    } catch (error) {
      return handleApiError(error);
    }
  };
}

/**
 * 统一的错误处理
 */
export function handleApiError(error: unknown): NextResponse {
  console.error("API error:", error);

  // Zod验证错误
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues[0].message,
          details: error.issues,
        },
      },
      { status: 400 },
    );
  }

  // 认证错误
  if (error instanceof Error && error.message.includes("Unauthorized")) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "请先登录",
          details: error.message,
        },
      },
      { status: 401 },
    );
  }

  // Prisma错误
  if (error instanceof Error && error.name === "PrismaClientKnownRequestError") {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "DATABASE_ERROR",
          message: "数据库操作失败",
          details: error.message,
        },
      },
      { status: 500 },
    );
  }

  // 外键约束错误
  if (error instanceof Error && error.message.includes("Foreign key constraint")) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "FOREIGN_KEY_ERROR",
          message: "数据关联错误，请确保用户已登录且数据完整",
          details: error.message,
        },
      },
      { status: 400 },
    );
  }

  // 通用服务器错误
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "服务器内部错误",
        details: error instanceof Error ? error.message : "Unknown error",
      },
    },
    { status: 500 },
  );
}

/**
 * 通用的分页参数解析
 */
export function parsePaginationParams(searchParams: URLSearchParams) {
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || "20")));
  const skip = (page - 1) * pageSize;

  return { page, pageSize, skip };
}

/**
 * 通用的分页响应构造器
 */
export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): ApiResponse<T[]> {
  return {
    success: true,
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * 数据验证装饰器
 */
export function withValidation<T>(schema: z.ZodSchema<T>) {
  return <U>(
    handler: (context: ApiContext, validatedData: T, params?: any) => Promise<ApiResponse<U>>,
  ): ApiHandler<U> =>
    async (context: ApiContext, params?: any) => {
      const body = await context.req.json();
      const validatedData = schema.parse(body);
      return handler(context, validatedData, params);
    };
}

/**
 * 权限检查辅助函数
 */
export async function ensureOwnership(
  prisma: any,
  model: string,
  id: string,
  userId: string,
): Promise<boolean> {
  const record = await prisma[model].findFirst({
    where: { id, userId },
    select: { id: true },
  });
  return !!record;
}

/**
 * 成功响应构造器
 */
export function successResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
  };
}

/**
 * 错误响应构造器
 */
export function errorResponse(code: string, message: string): ApiResponse {
  return {
    success: false,
    error: { code, message },
  };
}
