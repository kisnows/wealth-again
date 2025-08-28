"use client";

import useSWR from "swr";
import { getJson, putJson } from "@/lib/utils/fetcher";

export function useCities() {
  return useSWR<any>("/api/v1/rules/cities", getJson);
}

export async function upsertCities(
  items: Array<{ name: string; country?: string }>,
) {
  return putJson("/api/v1/rules/cities", items);
}

export function useSocialSecurity(city?: string, on?: string) {
  const key =
    city && on ? `/api/v1/rules/social-security?city=${city}&on=${on}` : null;
  return useSWR<any>(key, getJson);
}

export async function upsertSocialSecurity(items: any[]) {
  return putJson("/api/v1/rules/social-security", items);
}

export function useHousingFund(city?: string, on?: string) {
  const key =
    city && on ? `/api/v1/rules/housing-fund?city=${city}&on=${on}` : null;
  return useSWR<any>(key, getJson);
}

export async function upsertHousingFund(items: any[]) {
  return putJson("/api/v1/rules/housing-fund", items);
}

export async function upsertTaxConfig(input: {
  country: string;
  taxYear: number;
  standardDeduction: number;
  specialAdditionalDeduction?: number;
}) {
  return putJson("/api/v1/rules/tax/config", input);
}

export function useTaxBrackets(country?: string, taxYear?: number) {
  const key = country
    ? `/api/v1/rules/tax/brackets?country=${country}${taxYear ? `&taxYear=${taxYear}` : ""}`
    : null;
  return useSWR<any>(key, getJson);
}

export async function upsertTaxBrackets(items: any[]) {
  return putJson("/api/v1/rules/tax/brackets", items);
}
