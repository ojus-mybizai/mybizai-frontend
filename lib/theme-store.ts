import { create } from "zustand";

export type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set: (partial: Partial<ThemeState>) => void, get: () => ThemeState) => ({
  theme: "light",
  setTheme: (theme: Theme) => set({ theme }),
  toggleTheme: () => {
    const current = get().theme;
    set({ theme: current === "light" ? "dark" : "light" });
  },
}));
