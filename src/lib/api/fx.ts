"use client";

import useSWR from "swr";
import { getJson, postJson } from "@/lib/utils/fetcher";

export async function getFxRate(base: string, quote: string, on?: string) {
  const p = new URLSearchParams({ base, quote });
  if (on) p.set("on", on);
  return getJson(`/api/v1/fx/rates?${p.toString()}`);
}

export async function createFxRate(input: {
  base: string;
  quote: string;
  rate: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
}) {
  return postJson("/api/v1/fx/rates", input);
}

export type LatestFxRate = {
  quote: string;
  rate: number | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
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
      ? `/api/v1/fx/rates/latest?quotes=${normalized.join(",")}`
      : null;
  return useSWR<{ base: string; items: LatestFxRate[] }>(key, getJson);
}
