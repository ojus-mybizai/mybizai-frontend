import { useAuthStore } from "./auth-store";
import { broadcastAuthEvent } from "./auth-events";

export const API_BASE_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
  "http://127.0.0.1:8000/api/v1";

export interface ApiError extends Error {
  status: number;
  data?: unknown;
}

export interface RequestOptions extends RequestInit {
  auth?: boolean;
}

let refreshPromise: Promise<string | null> | null = null;

function isAuthPath(path: string): boolean {
  const cleanPath = path.startsWith("http")
    ? new URL(path).pathname
    : path;
  return [
    "/auth/signup",
    "/auth/resend-otp",
    "/auth/verify-email",
    "/auth/login",
    "/auth/refresh",
    "/auth/logout",
  ].some((p) => cleanPath.endsWith(p));
}

async function buildError(response: Response): Promise<ApiError> {
  let message = `Request failed with status ${response.status}`;
  let data: unknown;

  try {
    data = await response.json();
    if (data && typeof data === "object") {
      const payload = data as Record<string, unknown>;
      const maybeMsg =
        (typeof payload.message === "string" && payload.message) ||
        (typeof payload.detail === "string" && payload.detail) ||
        null;
      if (maybeMsg) {
        message = maybeMsg;
      }
    }
  } catch {
    // ignore JSON parse errors
  }

  const error = new Error(message) as ApiError;
  error.status = response.status;
  error.data = data;
  return error;
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw await buildError(response);
    }

    const data = await response.json();
    const payload = data as Record<string, unknown>;
    const accessToken =
      (typeof payload.access_token === "string" && payload.access_token) ||
      (typeof payload.accessToken === "string" && payload.accessToken) ||
      null;
    const user =
      payload.user && typeof payload.user === "object"
        ? (payload.user as Record<string, unknown>)
        : null;
    const onboardingRequired =
      (payload.onboarding_required as boolean | undefined) ??
      (payload.onboardingRequired as boolean | undefined) ??
      false;
    const defaultBusinessId =
      (payload.default_business_id as number | null | undefined) ??
      (payload.defaultBusinessId as number | null | undefined) ??
      null;
    const defaultRole =
      (payload.default_role as "owner" | "manager" | "executive" | null | undefined) ??
      (payload.defaultRole as "owner" | "manager" | "executive" | null | undefined) ??
      null;
    const hasActiveBusinessAccess =
      (payload.has_active_business_access as boolean | undefined) ??
      (payload.hasActiveBusinessAccess as boolean | undefined) ??
      true;

    const state = useAuthStore.getState();
    state.setAccessToken(accessToken);
    state.setUser(user);
    state.setOnboardingRequired(Boolean(onboardingRequired));
    state.setDefaultBusinessId(
      typeof defaultBusinessId === "number" ? defaultBusinessId : null
    );
    state.setDefaultRole(defaultRole);
    state.setHasActiveBusinessAccess(Boolean(hasActiveBusinessAccess));

    if (typeof window !== "undefined") {
      broadcastAuthEvent("refresh");
    }

    return accessToken;
  } catch {
    const state = useAuthStore.getState();
    state.logout();
    if (typeof window !== "undefined") {
      broadcastAuthEvent("logout");
    }
    return null;
  }
}

export async function refreshSession(): Promise<string | null> {
  return refreshAccessToken();
}

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { auth = true, ...rest } = options;

  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

  const headers = new Headers(rest.headers || {});
  // Don't force Content-Type for FormData; the browser will set multipart boundary.
  const isFormData =
    typeof FormData !== "undefined" && rest.body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const state = useAuthStore.getState();
  const token = state.accessToken;

  if (auth && token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers,
      credentials: "include",
    });
  } catch (error) {
    // Handle network errors (CORS, connection refused, etc.)
    const networkError = new Error(
      `Network error: ${error instanceof Error ? error.message : "Failed to fetch"}. Please check if the server is running and accessible.`
    ) as ApiError;
    networkError.status = 0;
    networkError.data = { originalError: String(error) };
    throw networkError;
  }

  if (response.status !== 401 || !auth || isAuthPath(path)) {
    if (!response.ok) {
      throw await buildError(response);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return response.json() as Promise<T>;
  }

  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }

  const newToken = await refreshPromise;

  if (!newToken) {
    throw await buildError(response);
  }

  const retryHeaders = new Headers(rest.headers || {});
  if (!isFormData && !retryHeaders.has("Content-Type")) {
    retryHeaders.set("Content-Type", "application/json");
  }
  retryHeaders.set("Authorization", `Bearer ${newToken}`);

  let retryResponse: Response;
  try {
    retryResponse = await fetch(url, {
      ...rest,
      headers: retryHeaders,
      credentials: "include",
    });
  } catch (error) {
    // Handle network errors on retry
    const networkError = new Error(
      `Network error on retry: ${error instanceof Error ? error.message : "Failed to fetch"}. Please check if the server is running and accessible.`
    ) as ApiError;
    networkError.status = 0;
    networkError.data = { originalError: String(error) };
    throw networkError;
  }

  if (!retryResponse.ok) {
    throw await buildError(retryResponse);
  }

  if (retryResponse.status === 204) {
    return undefined as T;
  }
  return retryResponse.json() as Promise<T>;
}
