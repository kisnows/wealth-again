// API服务层 - 统一管理所有收入相关的API调用

import type { ApiResponse } from "@/hooks/use-income-data";

// 基础API配置
const API_BASE = "/api";
const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
};

// 统一的错误处理
class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// 通用API请求函数
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;

    const response = await fetch(url, {
      headers: DEFAULT_HEADERS,
      ...options,
    });

    if (!response.ok) {
      throw new ApiError("HTTP_ERROR", `HTTP Error: ${response.status}`, response.status);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError("NETWORK_ERROR", error instanceof Error ? error.message : "Network error");
  }
}

// 收入变更相关API
export const incomeChangeApi = {
  // 获取收入变更列表
  async list(params: { page?: number; pageSize?: number } = {}) {
    const query = new URLSearchParams({
      page: (params.page || 1).toString(),
      pageSize: (params.pageSize || 50).toString(),
    });

    return apiRequest<any[]>(`/income/changes?${query}`);
  },

  // 创建收入变更
  async create(data: {
    city: string;
    grossMonthly: number;
    effectiveFrom: string;
    currency?: string;
  }) {
    return apiRequest("/income/changes", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // 删除收入变更
  async delete(id: string) {
    return apiRequest(`/income/changes?id=${id}`, {
      method: "DELETE",
    });
  },
};

// 奖金计划相关API
export const bonusApi = {
  // 获取奖金计划列表
  async list(params: { page?: number; pageSize?: number } = {}) {
    const query = new URLSearchParams({
      page: (params.page || 1).toString(),
      pageSize: (params.pageSize || 50).toString(),
    });

    return apiRequest<any[]>(`/income/bonus?${query}`);
  },

  // 创建奖金计划
  async create(data: { city: string; amount: number; effectiveDate: string; currency?: string }) {
    return apiRequest("/income/bonus", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // 删除奖金计划
  async delete(id: string) {
    return apiRequest(`/income/bonus?id=${id}`, {
      method: "DELETE",
    });
  },
};

// 长期现金相关API
export const longTermCashApi = {
  // 获取长期现金列表
  async list(params: { page?: number; pageSize?: number } = {}) {
    const query = new URLSearchParams({
      page: (params.page || 1).toString(),
      pageSize: (params.pageSize || 50).toString(),
    });

    return apiRequest<any[]>(`/income/long-term-cash?${query}`);
  },

  // 创建长期现金
  async create(data: {
    city: string;
    totalAmount: number;
    effectiveDate: string;
    currency?: string;
  }) {
    return apiRequest("/income/long-term-cash", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // 删除长期现金
  async delete(id: string) {
    return apiRequest(`/income/long-term-cash?id=${id}`, {
      method: "DELETE",
    });
  },
};

// 收入预测相关API
export const forecastApi = {
  // 获取收入预测
  async get(params: { start: string; end: string; city?: string }) {
    const query = new URLSearchParams({
      start: params.start,
      end: params.end,
      ...(params.city && { city: params.city }),
    });

    return apiRequest<{
      results: any[];
      totals: {
        totalSalary: number;
        totalBonus: number;
        totalLongTermCash: number;
        totalGross: number;
        totalNet: number;
        totalTax: number;
      };
    }>(`/income/forecast?${query}`);
  },
};

// 用户配置相关API
export const userConfigApi = {
  // 获取用户配置
  async get() {
    return apiRequest<{
      baseCurrency: string;
      [key: string]: any;
    }>("/user/profile");
  },

  // 更新用户配置
  async update(data: { baseCurrency?: string; [key: string]: any }) {
    return apiRequest("/user/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
};

// 税务配置相关API
export const taxConfigApi = {
  // 获取支持的城市列表
  async getCities() {
    return apiRequest<{ cities: string[] }>("/config/tax-params/cities");
  },
};

// 汇率相关API
export const fxRateApi = {
  // 获取汇率
  async get(params: { base?: string; quote?: string; asOf?: string } = {}) {
    const query = new URLSearchParams(
      Object.entries(params)
        .filter(([_, value]) => value)
        .map(([key, value]) => [key, value!]),
    );

    return apiRequest<any[]>(`/fx-rates?${query}`);
  },
};

// 统一导出
export const apiService = {
  incomeChange: incomeChangeApi,
  bonus: bonusApi,
  longTermCash: longTermCashApi,
  forecast: forecastApi,
  userConfig: userConfigApi,
  taxConfig: taxConfigApi,
  fxRate: fxRateApi,
};

// 导出错误类型
export { ApiError };
