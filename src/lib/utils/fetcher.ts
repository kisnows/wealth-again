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
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function getJson<T = unknown>(url: string, headers?: HeadersInit) {
  return fetchJson<T>(url, { method: "GET", headers });
}

export async function postJson<T = unknown>(
  url: string,
  body: unknown,
  idempotencyKey?: string,
) {
  return fetchJson<T>(url, {
    method: "POST",
    body,
    idempotent: true,
    idempotencyKey,
  });
}

export async function putJson<T = unknown>(
  url: string,
  body: unknown,
  idempotencyKey?: string,
) {
  return fetchJson<T>(url, {
    method: "PUT",
    body,
    idempotent: true,
    idempotencyKey,
  });
}

export async function patchJson<T = unknown>(
  url: string,
  body: unknown,
  idempotencyKey?: string,
) {
  return fetchJson<T>(url, {
    method: "PATCH",
    body,
    idempotent: true,
    idempotencyKey,
  });
}
