"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Locale } from "./constants";

interface UiState {
  locale: Locale;
  theme: "light" | "dark";
  setLocale: (l: Locale) => void;
  toggleTheme: () => void;
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      locale: "en",
      theme: "light",
      setLocale: (locale) => set({ locale }),
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
    }),
    { name: "dkmn-ui" },
  ),
);
