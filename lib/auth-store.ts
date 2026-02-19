import { create } from "zustand";
import { broadcastAuthEvent } from "./auth-events";

const ACCESS_TOKEN_KEY = "access_token";

function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

function persistAccessToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export type User = Record<string, unknown> | null;
export type DefaultRole = "owner" | "manager" | "executive" | null;

export interface AuthState {
  accessToken: string | null;
  user: User;
  onboardingRequired: boolean;
  defaultBusinessId: number | null;
  defaultRole: DefaultRole;
  hasActiveBusinessAccess: boolean;
  isInitialized: boolean;
  setAccessToken: (token: string | null) => void;
  setUser: (user: User) => void;
  setOnboardingRequired: (value: boolean) => void;
  setDefaultBusinessId: (value: number | null) => void;
  setDefaultRole: (value: DefaultRole) => void;
  setHasActiveBusinessAccess: (value: boolean) => void;
  setInitialized: (value: boolean) => void;
  logout: (broadcast?: boolean) => void;
}

export const useAuthStore = create<AuthState>((set: (partial: Partial<AuthState>) => void) => ({
  accessToken: getStoredAccessToken(),
  user: null,
  onboardingRequired: false,
  defaultBusinessId: null,
  defaultRole: null,
  hasActiveBusinessAccess: true,
  isInitialized: false,
  setAccessToken: (token: string | null) => {
    persistAccessToken(token);
    set({ accessToken: token });
  },
  setUser: (user: User) => set({ user }),
  setOnboardingRequired: (value: boolean) => set({ onboardingRequired: value }),
  setDefaultBusinessId: (value: number | null) => set({ defaultBusinessId: value }),
  setDefaultRole: (value: DefaultRole) => set({ defaultRole: value }),
  setHasActiveBusinessAccess: (value: boolean) => set({ hasActiveBusinessAccess: value }),
  setInitialized: (value: boolean) => set({ isInitialized: value }),
  logout: (broadcast: boolean = true) => {
    persistAccessToken(null);
    set({
      accessToken: null,
      user: null,
      onboardingRequired: false,
      defaultBusinessId: null,
      defaultRole: null,
      hasActiveBusinessAccess: false,
    });
    if (broadcast && typeof window !== "undefined") {
      broadcastAuthEvent("logout");
    }
  },
}));
