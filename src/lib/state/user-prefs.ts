"use client";

import { create } from "zustand";

type UserPrefsState = {
  displayCurrency: string | null;
  currentCity: string | null;
  asOfDate: string | null; // YYYY-MM-DD
  tableDensity: "comfortable" | "compact";
  setDisplayCurrency: (ccy: string | null) => void;
  setCurrentCity: (city: string | null) => void;
  setAsOfDate: (date: string | null) => void;
  setTableDensity: (d: UserPrefsState["tableDensity"]) => void;
};

export const useUserPrefsStore = create<UserPrefsState>((set) => ({
  displayCurrency: null,
  currentCity: null,
  asOfDate: null,
  tableDensity: "comfortable",
  setDisplayCurrency: (displayCurrency) => set({ displayCurrency }),
  setCurrentCity: (currentCity) => set({ currentCity }),
  setAsOfDate: (asOfDate) => set({ asOfDate }),
  setTableDensity: (tableDensity) => set({ tableDensity }),
}));
