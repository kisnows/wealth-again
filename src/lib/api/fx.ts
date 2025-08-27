"use client";

import { getJson, postJson } from "@/lib/utils/fetcher";

export async function getFxRate(base: string, quote: string, on?: string) {
  const p = new URLSearchParams({ base, quote });
  if (on) p.set("on", on);
  return getJson(`/api/v1/fxrates?${p.toString()}`);
}

export async function createFxRate(input: { base: string; quote: string; rate: number; asOf: string }) {
  return postJson("/api/v1/fxrates", input);
}

