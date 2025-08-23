"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

// 通用API响应类型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 通用数据获取hook
 */
export function useApiData<T>(
  endpoint: string,
  dependencies: any[] = [],
  options: {
    immediate?: boolean;
    onSuccess?: (data: T) => void;
    onError?: (error: string) => void;
  } = {}
) {
  const { data: session } = useSession();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const fetchData = useCallback(async () => {
    if (!session) return;
    
    setLoading(true);
    setError("");

    try {
      const response = await fetch(endpoint);
      const result: ApiResponse<T> = await response.json();

      if (result.success && result.data) {
        setData(result.data);
        options.onSuccess?.(result.data);
      } else {
        const errorMsg = result.error?.message || "获取数据失败";
        setError(errorMsg);
        options.onError?.(errorMsg);
      }
    } catch (err) {
      const errorMsg = "网络错误，请稍后重试";
      setError(errorMsg);
      options.onError?.(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [endpoint, session, options]);

  useEffect(() => {
    if (options.immediate !== false) {
      fetchData();
    }
  }, [fetchData, ...dependencies]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    setData,
    setError
  };
}

/**
 * 收入相关数据的hook
 */
export function useIncomeData(dateRange?: { start: string; end: string }) {
  const { data: session } = useSession();
  const [incomeData, setIncomeData] = useState({
    bonuses: [] as any[],
    changes: [] as any[],
    longTermCash: [] as any[],
    forecast: [] as any[],
    totals: {
      totalSalary: 0,
      totalBonus: 0,
      totalLongTermCash: 0,
      totalGross: 0,
      totalNet: 0,
      totalTax: 0,
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadIncomeData = useCallback(async () => {
    if (!session) return;

    setLoading(true);
    setError("");

    try {
      const queries = [
        "/api/income/bonus?page=1&pageSize=50",
        "/api/income/changes?page=1&pageSize=50", 
        "/api/income/long-term-cash?page=1&pageSize=50"
      ];

      if (dateRange) {
        queries.push(`/api/income/forecast?start=${dateRange.start}&end=${dateRange.end}`);
      }

      const responses = await Promise.all(
        queries.map(url => fetch(url).then(r => r.json()))
      );

      const [bonuses, changes, longTermCash, forecast] = responses;

      setIncomeData({
        bonuses: bonuses.success ? bonuses.data || [] : bonuses.records || [],
        changes: changes.records || [],
        longTermCash: longTermCash.success ? longTermCash.data || [] : longTermCash.records || [],
        forecast: forecast?.results || [],
        totals: forecast?.totals || {
          totalSalary: 0,
          totalBonus: 0,
          totalLongTermCash: 0,
          totalGross: 0,
          totalNet: 0,
          totalTax: 0,
        }
      });

    } catch (err) {
      setError("获取收入数据失败");
      console.error("Error loading income data:", err);
    } finally {
      setLoading(false);
    }
  }, [session, dateRange]);

  useEffect(() => {
    loadIncomeData();
  }, [loadIncomeData]);

  // 监听自定义事件进行刷新
  useEffect(() => {
    const handleRefresh = () => loadIncomeData();
    window.addEventListener("income:refresh", handleRefresh);
    return () => window.removeEventListener("income:refresh", handleRefresh);
  }, [loadIncomeData]);

  return {
    ...incomeData,
    loading,
    error,
    refresh: loadIncomeData,
    setError
  };
}

/**
 * 用户配置数据的hook
 */
export function useUserConfig() {
  const { data: session } = useSession();
  const [userConfig, setUserConfig] = useState({
    baseCurrency: "CNY",
    cities: ["Hangzhou", "Shanghai", "Beijing", "Shenzhen"]
  });
  const [loading, setLoading] = useState(false);

  const updateUserConfig = useCallback(async (updates: Partial<typeof userConfig>) => {
    if (!session) return;

    try {
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        setUserConfig(prev => ({ ...prev, ...updates }));
      }
    } catch (error) {
      console.error("Failed to update user config:", error);
    }
  }, [session]);

  useEffect(() => {
    async function loadUserConfig() {
      if (!session) return;
      
      setLoading(true);
      try {
        const [userResponse, citiesResponse] = await Promise.all([
          fetch("/api/user/profile").then(r => r.json()),
          fetch("/api/config/tax-params/cities").then(r => r.json())
        ]);

        setUserConfig({
          baseCurrency: userResponse.data?.baseCurrency || "CNY",
          cities: citiesResponse.cities?.length > 0 ? citiesResponse.cities : ["Hangzhou", "Shanghai", "Beijing", "Shenzhen"]
        });
      } catch (error) {
        console.error("Failed to load user config:", error);
      } finally {
        setLoading(false);
      }
    }

    loadUserConfig();
  }, [session]);

  return {
    ...userConfig,
    loading,
    updateUserConfig
  };
}

/**
 * 表单操作的通用hook
 */
export function useFormSubmit<T>(
  endpoint: string,
  options: {
    method?: 'POST' | 'PUT' | 'DELETE';
    onSuccess?: (data: any) => void;
    onError?: (error: string) => void;
    successMessage?: string;
  } = {}
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submit = useCallback(async (data: T, customEndpoint?: string) => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(customEndpoint || endpoint, {
        method: options.method || 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (result.success) {
        const message = options.successMessage || "操作成功";
        setSuccess(message);
        options.onSuccess?.(result.data);
        
        // 触发全局刷新事件
        window.dispatchEvent(new CustomEvent("income:refresh"));
      } else {
        const errorMsg = result.error?.message || "操作失败";
        setError(errorMsg);
        options.onError?.(errorMsg);
      }
    } catch (err) {
      const errorMsg = "网络错误，请稍后重试";
      setError(errorMsg);
      options.onError?.(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [endpoint, options]);

  const clearMessages = useCallback(() => {
    setError("");
    setSuccess("");
  }, []);

  return {
    submit,
    loading,
    error,
    success,
    clearMessages
  };
}