"use client";

import useSWR from "swr";
import { headersWithIdempotency, makeIdempotencyKey } from "@/lib/utils/idempotency";
import { getJson } from "@/lib/utils/fetcher";

// 用户信息类型
export interface CurrentUser {
  id: string;
  email: string;
  name?: string;
  currentCityId: string;
  displayCurrency: string | null;
  role?: string | null;
  isAdmin?: boolean;
}

// 获取当前用户信息的hook
export function useCurrentUser(enabled = true) {
  const key = enabled ? "/api/v1/identity/auth/me" : null;
  return useSWR<CurrentUser>(key, getJson);
}

// 获取当前用户ID的便捷hook
export function useCurrentUserId(): string | undefined {
  const { data } = useCurrentUser(true);
  return data?.id;
}

export type RegisterUserPayload = {
  email: string;
  password: string;
  name?: string;
  cityId: string;
  displayCurrency?: string | null;
};

export type RegisterUserResponse = {
  id: string;
  email: string;
  name: string | null;
  currentCityId: string;
  displayCurrency: string | null;
};

export class RegisterUserError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "RegisterUserError";
  }
}

export async function registerUser(
  payload: RegisterUserPayload,
): Promise<RegisterUserResponse> {
  const res = await fetch("/api/v1/identity/register", {
    method: "POST",
    headers: headersWithIdempotency(
      undefined,
      makeIdempotencyKey("register"),
    ),
    body: JSON.stringify(payload),
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // ignore parse errors, we'll fall back to generic message
  }
  if (!res.ok) {
    const errorCode =
      data && typeof data === "object" && "error" in data
        ? String((data as { error?: unknown }).error)
        : undefined;
    throw new RegisterUserError(
      errorCode ?? "register_failed",
      errorCode,
    );
  }
  return data as RegisterUserResponse;
}
