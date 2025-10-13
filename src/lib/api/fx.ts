"use client";

import useSWR from "swr";
import { getJson, postJson } from "@/lib/utils/fetcher";

export async function getFxRate(base: string, quote: string, on?: string) {
  const p = new URLSearchParams({ base, quote });
  if (on) p.set("on", on);
  return getJson(`/api/v1/fxrates?${p.toString()}`);
}

export async function createFxRate(input: {
  base: string;
  quote: string;
  rate: number;
  asOf: string;
}) {
  return postJson("/api/v1/fxrates", input);
}

export type LatestFxRate = {
  quote: string;
  rate: number | null;
  asOf: string | null;
};

export function useLatestFxRates(quotes: string[]) {
  const normalized = Array.from(
    new Set(
      quotes
        .map((quote) => quote.toUpperCase())
        .filter((quote) => quote.length > 0),
    ),
  );
  const key =
    normalized.length > 0
      ? `/api/v1/fxrates/latest?quotes=${normalized.join(",")}`
      : null;
  return useSWR<{ base: string; items: LatestFxRate[] }>(key, getJson);
}
