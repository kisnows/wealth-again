"use client";

import useSWR, { mutate as globalMutate } from "swr";
import { getJson, patchJson, postJson } from "@/lib/utils/fetcher";

export type CurrentUser = {
  id: string;
  email: string;
  name?: string | null;
  currentCityId: string;
  displayCurrency: string | null;
};

export type CurrentCity = {
  id: string;
  name: string;
  country: string;
};

export type CityChangeItem = {
  id: string;
  fromCityId?: string | null;
  toCityId: string;
  effectiveMonth: string;
  reason?: string | null;
  createdAt: string;
  toCity?: CurrentCity;
  fromCity?: CurrentCity | null;
};

export type CityChangeResponse = {
  currentCity: CurrentCity | null;
  items: CityChangeItem[];
};

const USER_PROFILE_KEY = "/api/v1/identity/auth/me";
const CITY_CHANGES_KEY = "/api/v1/identity/city-changes";

export function useCurrentUser() {
  return useSWR<CurrentUser>(USER_PROFILE_KEY, (url) => getJson(url));
}

export async function updateDisplayCurrency(displayCurrency: string | null) {
  const result = await patchJson<CurrentUser>("/api/v1/identity/auth/me", {
    displayCurrency,
  });
  await globalMutate(USER_PROFILE_KEY);
  return result;
}

export function useCityChanges() {
  return useSWR<CityChangeResponse>(CITY_CHANGES_KEY, (url) => getJson(url));
}

export async function createCityChange(input: {
  toCityId: string;
  effectiveMonth?: string;
  reason?: string;
}) {
  const result = await postJson(CITY_CHANGES_KEY, input);
  await Promise.all([
    globalMutate(CITY_CHANGES_KEY),
    globalMutate(USER_PROFILE_KEY),
  ]);
  return result;
}

export function useAllCities() {
  return useSWR<Array<CurrentCity>>(
    "/api/v1/identity/cities",
    (url) => getJson(url),
  );
}
