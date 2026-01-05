"use client";

import useSWR from "swr";
import { getJson, putJson } from "@/lib/utils/fetcher";
import type {
  City,
  CityRuleHF,
  CityRuleSS,
  TaxBracket,
} from "@/server/db/types";

export function useCities() {
  return useSWR<City[]>("/api/v1/income-tax/rules/cities", getJson);
}

export async function upsertCities(
  items: Array<{ name: string; country?: string }>,
) {
  return putJson("/api/v1/income-tax/rules/cities", items);
}

export type SocialSecurityRuleInput = {
  city: string;
  country?: string;
  baseMin: number;
  baseMax: number;
  ratePension: number;
  rateMedical: number;
  rateUnemployment: number;
  fixedMedicalPersonal?: number | null;
  currency?: string | null;
  startDate?: string;
  endDate?: string | null;
  effectiveFrom?: string;
  effectiveTo?: string | null;
};

export function useSocialSecurity(city?: string, on?: string) {
  const key =
    city && on
      ? `/api/v1/income-tax/rules/social-security?city=${city}&on=${on}`
      : null;
  return useSWR<CityRuleSS | null>(key, getJson);
}

export async function upsertSocialSecurity(
  items: SocialSecurityRuleInput[],
) {
  return putJson("/api/v1/income-tax/rules/social-security", items);
}

export type HousingFundRuleInput = {
  city: string;
  country?: string;
  baseMin: number;
  baseMax: number;
  rateEmployee: number;
  currency?: string | null;
  startDate?: string;
  endDate?: string | null;
  effectiveFrom?: string;
  effectiveTo?: string | null;
};

export function useHousingFund(city?: string, on?: string) {
  const key =
    city && on
      ? `/api/v1/income-tax/rules/housing-fund?city=${city}&on=${on}`
      : null;
  return useSWR<CityRuleHF | null>(key, getJson);
}

export async function upsertHousingFund(items: HousingFundRuleInput[]) {
  return putJson("/api/v1/income-tax/rules/housing-fund", items);
}

export async function upsertTaxConfig(input: {
  country: string;
  taxYear: number;
  standardDeduction: number;
  specialAdditionalDeduction?: number;
}) {
  return putJson("/api/v1/income-tax/rules/tax/config", input);
}

export type TaxBracketListResponse = {
  items: TaxBracket[];
};

export function useTaxBrackets(country?: string, taxYear?: number) {
  const key = country
    ? `/api/v1/income-tax/rules/tax/brackets?country=${country}${taxYear ? `&taxYear=${taxYear}` : ""}`
    : null;
  return useSWR<TaxBracketListResponse | null>(key, getJson);
}

export type TaxBracketRuleInput = {
  country: string;
  taxYear: number;
  position: number;
  threshold: number;
  taxRate: number;
  quickDeduction: number;
};

export async function upsertTaxBrackets(items: TaxBracketRuleInput[]) {
  return putJson("/api/v1/income-tax/rules/tax/brackets", items);
}
