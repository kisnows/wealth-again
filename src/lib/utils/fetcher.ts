import {
  headersWithIdempotency,
  makeIdempotencyKey,
} from "@/lib/utils/idempotency";

export type FetchJsonOptions = {
  method?: string;
  body?: unknown;
  idempotent?: boolean;
  idempotencyKey?: string;
  headers?: HeadersInit;
};

export type MutationOptions = Omit<FetchJsonOptions, "method"> & {
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
};

export async function fetchJson<T = unknown>(
  url: string,
  opts: FetchJsonOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    idempotent = false,
    idempotencyKey,
    headers,
  } = opts;
  const key = idempotent
    ? (idempotencyKey ?? makeIdempotencyKey("cl"))
    : undefined;
  const res = await fetch(url, {
    method,
    headers: headersWithIdempotency(headers, key),
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    if (res.status === 401) {
      if (typeof window !== "undefined") {
        const loginUrl = new URL("/signin", window.location.origin);
        const callback =
          window.location.pathname + window.location.search;
        if (callback && callback !== "/signin") {
          loginUrl.searchParams.set("callbackUrl", callback);
        }
        void import("sonner").then(({ toast }) => {
          const globalWindow = window as typeof window & {
            __wa_login_toast__?: boolean;
          };
          if (!globalWindow.__wa_login_toast__) {
            globalWindow.__wa_login_toast__ = true;
            toast.warning("当前尚未登录", {
              description: "完成登录后即可继续访问当前功能。",
              action: {
                label: "去登录",
                onClick: () => {
                  window.location.href = loginUrl.toString();
                },
              },
              onDismiss: () => {
                globalWindow.__wa_login_toast__ = false;
              },
            });
            window.setTimeout(() => {
              globalWindow.__wa_login_toast__ = false;
            }, 6000);
          }
        });
      }
      throw new Error("请先登录后再执行此操作");
    }
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function getJson<T = unknown>(url: string, headers?: HeadersInit) {
  return fetchJson<T>(url, { method: "GET", headers });
}

export async function mutation<T = unknown>(
  url: string,
  options: MutationOptions = {},
) {
  const { method = "POST", idempotent, ...rest } = options;
  const resolvedIdempotent =
    idempotent ?? (method !== "DELETE" && method !== "GET");
  return fetchJson<T>(url, {
    ...rest,
    method,
    idempotent: resolvedIdempotent,
  });
}

export async function postJson<T = unknown>(
  url: string,
  body: unknown,
  idempotencyKey?: string,
) {
  return mutation<T>(url, {
    body,
    idempotencyKey,
  });
}

export async function putJson<T = unknown>(
  url: string,
  body: unknown,
  idempotencyKey?: string,
) {
  return mutation<T>(url, {
    method: "PUT",
    body,
    idempotencyKey,
  });
}

export async function patchJson<T = unknown>(
  url: string,
  body: unknown,
  idempotencyKey?: string,
) {
  return mutation<T>(url, {
    method: "PATCH",
    body,
    idempotencyKey,
  });
}

export async function deleteJson<T = unknown>(url: string) {
  return mutation<T>(url, { method: "DELETE", idempotent: false });
}
