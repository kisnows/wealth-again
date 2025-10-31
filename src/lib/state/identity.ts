"use client";

import { create } from "zustand";

type UserPrefsState = {
  displayCurrency: string | null;
  currentCity: string | null;
  asOfDate: string | null; // YYYY-MM-DD
  tableDensity: "comfortable" | "compact";
  pendingTasks: number;
  lastDataSyncAt: string | null;
  setDisplayCurrency: (ccy: string | null) => void;
  setCurrentCity: (city: string | null) => void;
  setAsOfDate: (date: string | null) => void;
  setTableDensity: (d: UserPrefsState["tableDensity"]) => void;
  setPendingTasks: (count: number) => void;
  setLastDataSyncAt: (value: string | null) => void;
};

export const useUserPrefsStore = create<UserPrefsState>((set) => ({
  displayCurrency: null,
  currentCity: null,
  asOfDate: null,
  tableDensity: "comfortable",
  pendingTasks: 0,
  lastDataSyncAt: null,
  setDisplayCurrency: (displayCurrency) => set({ displayCurrency }),
  setCurrentCity: (currentCity) => set({ currentCity }),
  setAsOfDate: (asOfDate) => set({ asOfDate }),
  setTableDensity: (tableDensity) => set({ tableDensity }),
  setPendingTasks: (pendingTasks) => set({ pendingTasks }),
  setLastDataSyncAt: (lastDataSyncAt) => set({ lastDataSyncAt }),
}));
