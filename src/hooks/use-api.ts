import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useNotifications, useCache, useLoading } from '@/lib/app-state';

// 通用API Hook配置
interface UseApiOptions<T> {
  immediate?: boolean;
  cacheKey?: string;
  cacheTTL?: number;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  retry?: number;
  retryDelay?: number;
}

// 通用API状态
interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  lastFetched: number | null;
}

// 通用API Hook
export function useApi<T = any>(
  url: string | null,
  options: UseApiOptions<T> = {}
) {
  const { data: session } = useSession();
  const { addNotification } = useNotifications();
  const { cache, updateCache, isCacheValid } = useCache();
  const { setOperationLoading } = useLoading();
  
  const {
    immediate = true,
    cacheKey,
    cacheTTL = 5 * 60 * 1000, // 5分钟默认缓存
    onSuccess,
    onError,
    retry = 0,
    retryDelay = 1000,
  } = options;

  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
    lastFetched: null,
  });

  const retryCountRef = useRef(0);
  const operationKey = `api-${url || 'unknown'}`;

  // 检查缓存
  const getCachedData = useCallback(() => {
    if (!cacheKey) return null;
    
    if (isCacheValid(cacheKey as keyof typeof cache, cacheTTL)) {
      return (cache as any)[cacheKey];
    }
    return null;
  }, [cacheKey, cache, isCacheValid, cacheTTL]);

  // 执行API请求
  const execute = useCallback(async (requestUrl?: string) => {
    const targetUrl = requestUrl || url;
    if (!targetUrl || !session) return;

    // 检查缓存
    const cachedData = getCachedData();
    if (cachedData && !requestUrl) { // 只在自动请求时使用缓存
      setState(prev => ({ ...prev, data: cachedData, loading: false }));
      return cachedData;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));
    setOperationLoading(operationKey, true);

    try {
      const response = await fetch(targetUrl, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      const data = result.success ? result.data : result;

      setState({
        data,
        loading: false,
        error: null,
        lastFetched: Date.now(),
      });

      // 更新缓存
      if (cacheKey) {
        updateCache(cacheKey as keyof typeof cache, data);
      }

      retryCountRef.current = 0;
      onSuccess?.(data);
      return data;

    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      
      // 重试逻辑
      if (retryCountRef.current < retry) {
        retryCountRef.current++;
        setTimeout(() => execute(targetUrl), retryDelay * retryCountRef.current);
        return;
      }

      setState(prev => ({
        ...prev,
        loading: false,
        error: err,
      }));

      onError?.(err);
      addNotification({
        type: 'ERROR',
        title: '请求失败',
        message: err.message,
      });

      throw err;
    } finally {
      setOperationLoading(operationKey, false);
    }
  }, [url, session, getCachedData, cacheKey, updateCache, retry, retryDelay, onSuccess, onError, addNotification, setOperationLoading, operationKey]);

  // 初始化请求
  useEffect(() => {
    if (immediate && url && session) {
      execute();
    }
  }, [immediate, url, session, execute]);

  // 手动刷新
  const refresh = useCallback(() => {
    if (url) {
      return execute(url);
    }
  }, [url, execute]);

  // 清除数据
  const clear = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
      lastFetched: null,
    });
  }, []);

  return {
    ...state,
    execute,
    refresh,
    clear,
    isLoading: state.loading,
  };
}

// 专用Hook：获取账户列表
export function useAccounts() {
  return useApi('/api/accounts', {
    cacheKey: 'accounts',
    cacheTTL: 2 * 60 * 1000, // 2分钟缓存
  });
}

// 专用Hook：获取收入记录
export function useIncomeRecords(params: { year?: number; month?: number } = {}) {
  const queryString = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined) as [string, string][]
  ).toString();
  
  const url = queryString ? `/api/income/monthly?${queryString}` : '/api/income/monthly';
  
  return useApi(url, {
    cacheKey: 'incomeRecords',
    cacheTTL: 1 * 60 * 1000, // 1分钟缓存
  });
}

// 专用Hook：获取交易记录
export function useTransactions(accountId?: string) {
  const url = accountId ? `/api/investment/transactions?accountId=${accountId}` : '/api/investment/transactions';
  
  return useApi(url, {
    immediate: !!accountId,
  });
}

// 专用Hook：获取奖金计划
export function useBonusPlans() {
  return useApi('/api/income/bonus', {
    cacheKey: 'bonusPlans',
  });
}

// 通用POST Hook
export function useApiMutation<TData = any, TVariables = any>(
  url: string,
  options: {
    onSuccess?: (data: TData) => void;
    onError?: (error: Error) => void;
    invalidateCache?: string[];
  } = {}
) {
  const { data: session } = useSession();
  const { addNotification } = useNotifications();
  const { invalidateCache } = useCache();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (variables: TVariables, method: 'POST' | 'PUT' | 'DELETE' = 'POST') => {
    if (!session) {
      throw new Error('Not authenticated');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: method !== 'DELETE' ? JSON.stringify(variables) : undefined,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      const data = result.success ? result.data : result;

      // 清除相关缓存
      if (options.invalidateCache) {
        options.invalidateCache.forEach(key => {
          invalidateCache(key as keyof typeof invalidateCache);
        });
      }

      options.onSuccess?.(data);
      addNotification({
        type: 'SUCCESS',
        title: '操作成功',
        message: '数据已保存',
      });

      return data;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      setError(err);
      options.onError?.(err);
      addNotification({
        type: 'ERROR',
        title: '操作失败',
        message: err.message,
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [url, session, options, addNotification, invalidateCache]);

  return {
    mutate,
    loading,
    error,
  };
}

// 分页Hook
export function usePagination(initialPage = 1, initialPageSize = 20) {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const reset = useCallback(() => {
    setPage(initialPage);
    setPageSize(initialPageSize);
  }, [initialPage, initialPageSize]);

  const nextPage = useCallback(() => {
    setPage(prev => prev + 1);
  }, []);

  const prevPage = useCallback(() => {
    setPage(prev => Math.max(1, prev - 1));
  }, []);

  const goToPage = useCallback((targetPage: number) => {
    setPage(Math.max(1, targetPage));
  }, []);

  return {
    page,
    pageSize,
    setPage,
    setPageSize,
    nextPage,
    prevPage,
    goToPage,
    reset,
  };
}