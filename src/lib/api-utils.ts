// API 响应格式类型定义
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
  meta?: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ApiError extends Error {
  code: string;
  statusCode: number;
  details?: any;
}

// 创建标准化的成功响应
export function createSuccessResponse<T>(
  data: T, 
  pagination?: ApiResponse<T>['pagination'],
  meta?: Partial<ApiResponse<T>['meta']>
): ApiResponse<T> {
  return {
    success: true,
    data,
    ...(pagination && { pagination }),
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      version: '1.0',
      ...meta
    }
  };
}

// 创建标准化的错误响应
export function createErrorResponse(
  code: string,
  message: string,
  statusCode: number = 500,
  details?: any
): { response: ApiResponse; statusCode: number } {
  return {
    response: {
      success: false,
      error: {
        code,
        message,
        details
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        version: '1.0'
      }
    },
    statusCode
  };
}

// 常见错误代码
export const API_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
} as const;

// API 错误类
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// 分页参数验证和标准化
export function parsePaginationParams(
  searchParams: URLSearchParams,
  defaultPageSize: number = 20,
  maxPageSize: number = 100
): Required<PaginationParams> {
  const page = Math.max(1, Number(searchParams.get('page') || '1'));
  const pageSize = Math.min(
    maxPageSize,
    Math.max(1, Number(searchParams.get('pageSize') || defaultPageSize.toString()))
  );
  const sortBy = searchParams.get('sortBy') || 'createdAt';
  const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

  return { page, pageSize, sortBy, sortOrder };
}