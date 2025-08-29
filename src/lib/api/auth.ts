"use client";

import useSWR from "swr";
import { getJson } from "@/lib/utils/fetcher";

// 用户信息类型
export interface CurrentUser {
  id: string;
  email: string;
  name?: string;
  baseCurrency: string;
  currentCityId: string;
}

// 获取当前用户信息的hook
export function useCurrentUser() {
  return useSWR<CurrentUser>("/api/v1/auth/me", getJson);
}

// 获取当前用户ID的便捷hook
export function useCurrentUserId(): string | undefined {
  const { data } = useCurrentUser();
  return data?.id;
}
