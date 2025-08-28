export function makeIdempotencyKey(prefix = "req"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${(crypto as any).randomUUID()}`;
  }
  // Fallback for environments without crypto.randomUUID
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function headersWithIdempotency(
  headers?: HeadersInit,
  key?: string,
): HeadersInit {
  const h = new Headers(headers);
  h.set("Content-Type", "application/json");
  if (key) h.set("Idempotency-Key", key);
  return h;
}
