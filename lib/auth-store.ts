import { create } from "zustand";
import { broadcastAuthEvent } from "./auth-events";

const ACCESS_TOKEN_KEY = "access_token";
const USER_CACHE_KEY = "cached_user";

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

export function getStoredUser(): User {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function persistUser(user: User): void {
  if (typeof window === "undefined") return;
  try {
    if (user) {
      sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    } else {
      sessionStorage.removeItem(USER_CACHE_KEY);
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
  /** Permission-driven: keys for current business (from me/login). Owner has all. */
  permissionKeys: string[];
  /** True if current user is owner of default business. */
  isOwner: boolean;
  /** Current subscription plan slug (fetched once, cached for the session). */
  planSlug: string | null;
  /** Whether planSlug has been fetched at least once this session. */
  planLoaded: boolean;
  setAccessToken: (token: string | null) => void;
  setUser: (user: User) => void;
  setOnboardingRequired: (value: boolean) => void;
  setDefaultBusinessId: (value: number | null) => void;
  setDefaultRole: (value: DefaultRole) => void;
  setHasActiveBusinessAccess: (value: boolean) => void;
  setInitialized: (value: boolean) => void;
  setPermissionKeys: (keys: string[]) => void;
  setIsOwner: (value: boolean) => void;
  setPlanSlug: (slug: string) => void;
  /** True if user has the permission or is owner. */
  hasPermission: (key: string) => boolean;
  logout: (broadcast?: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: getStoredAccessToken(),
  user: null,
  onboardingRequired: false,
  defaultBusinessId: null,
  defaultRole: null,
  hasActiveBusinessAccess: true,
  isInitialized: false,
  permissionKeys: [],
  isOwner: false,
  planSlug: null,
  planLoaded: false,
  setAccessToken: (token: string | null) => {
    persistAccessToken(token);
    set({ accessToken: token });
  },
  setUser: (user: User) => {
    persistUser(user);
    set({ user });
  },
  setOnboardingRequired: (value: boolean) => set({ onboardingRequired: value }),
  setDefaultBusinessId: (value: number | null) => set({ defaultBusinessId: value }),
  setDefaultRole: (value: DefaultRole) => set({ defaultRole: value }),
  setHasActiveBusinessAccess: (value: boolean) => set({ hasActiveBusinessAccess: value }),
  setInitialized: (value: boolean) => set({ isInitialized: value }),
  setPermissionKeys: (keys: string[]) => set({ permissionKeys: keys }),
  setIsOwner: (value: boolean) => set({ isOwner: value }),
  setPlanSlug: (slug: string) => set({ planSlug: slug, planLoaded: true }),
  hasPermission: (key: string) => {
    const s = get();
    if (s.isOwner) return true;
    return Array.isArray(s.permissionKeys) && s.permissionKeys.includes(key);
  },
  logout: (broadcast: boolean = true) => {
    persistAccessToken(null);
    persistUser(null);
    set({
      accessToken: null,
      user: null,
      onboardingRequired: false,
      defaultBusinessId: null,
      defaultRole: null,
      hasActiveBusinessAccess: false,
      permissionKeys: [],
      isOwner: false,
      planSlug: null,
      planLoaded: false,
    });
    if (broadcast && typeof window !== "undefined") {
      broadcastAuthEvent("logout");
    }
  },
}));
