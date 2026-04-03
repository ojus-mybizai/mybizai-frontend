import { useAuthStore } from "./auth-store";
import { broadcastAuthEvent } from "./auth-events";

export const API_BASE_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
  "http://127.0.0.1:8000/api/v1";

// ---------------------------------------------------------------------------
// In-flight GET deduplication
// ---------------------------------------------------------------------------
// If two callers request the exact same GET URL simultaneously, we reuse the
// same in-flight Promise instead of making two network requests. The entry is
// removed as soon as the request settles.
const inflightGets = new Map<string, Promise<unknown>>();

// ---------------------------------------------------------------------------
// Dev-mode API performance logging
// ---------------------------------------------------------------------------
const DEV = process.env.NODE_ENV === 'development';

function logApiCall(method: string, url: string) {
  if (!DEV) return;
  // eslint-disable-next-line no-console
  console.log(`[API CALL] ${method} ${url}`);
}

export interface ApiError extends Error {
  status: number;
  data?: unknown;
}

/** Build a user-friendly message from API error (supports detail as string or object). */
export function formatApiErrorDetail(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as ApiError).data;
    if (data && typeof data === "object" && data !== null) {
      const payload = data as Record<string, unknown>;
      const detail = payload.detail;
      if (typeof detail === "string") return detail;
      if (detail && typeof detail === "object") {
        const d = detail as Record<string, unknown>;
        const msg = typeof d.message === "string" ? d.message : null;
        const invalidIds = d.invalid_tool_ids;
        if (Array.isArray(invalidIds) && invalidIds.length > 0) {
          const suffix = ` Invalid tool IDs: ${invalidIds.join(", ")}.`;
          return (msg ?? "One or more tools not found or are disabled") + suffix;
        }
        if (msg) return msg;
        const errors = d.errors;
        if (Array.isArray(errors) && errors.length > 0) {
          const first = errors[0];
          if (typeof first === "string") return first;
          if (first && typeof first === "object" && "error" in first)
            return String((first as { error: unknown }).error);
        }
      }
    }
  }
  return msg;
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

      // Case 1: simple string message or detail
      if (typeof payload.message === "string" && payload.message) {
        message = payload.message;
      } else if (typeof payload.detail === "string" && payload.detail) {
        message = payload.detail;
      }
      // Case 2: structured detail object (e.g., validation errors)
      else if (payload.detail && typeof payload.detail === "object") {
        const detail = payload.detail as Record<string, unknown>;
        if (typeof detail.message === "string") {
          message = detail.message;
        }
        // Append field-level errors for user clarity
        if (Array.isArray(detail.errors) && detail.errors.length > 0) {
          const fieldErrors = (detail.errors as Array<Record<string, string>>)
            .map((e) => {
              // Prefer the human-readable message from the backend
              if (e.message && e.message !== e.error) {
                return e.message;
              }
              // Fallback: build a message from field name + error code
              const fieldLabel = e.display_name || e.field || "Field";
              const err = e.error || "invalid";
              const errLabel =
                err === "not_unique" ? "must be unique — this value already exists"
                : err === "required" ? "is required"
                : err === "invalid_type" ? "has an invalid type"
                : err === "invalid_value" ? "has an invalid value"
                : err === "invalid_relation" ? "has an invalid linked record"
                : err;
              return `${fieldLabel}: ${errLabel}`;
            })
            .join("\n");
          message = fieldErrors;
        }
      }
      // Case 3: FastAPI Pydantic validation errors (array of {loc, msg, type})
      else if (Array.isArray(payload.detail)) {
        const msgs = (payload.detail as Array<{ loc?: string[]; msg?: string }>)
          .slice(0, 3)
          .map((e) => {
            const field = e.loc ? e.loc.filter((l) => l !== "body").join(".") : "";
            return field ? `${field}: ${e.msg}` : (e.msg || "");
          })
          .filter(Boolean);
        if (msgs.length > 0) {
          message = msgs.join(", ");
        }
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
    const rawUser =
      payload.user && typeof payload.user === "object"
        ? (payload.user as Record<string, unknown>)
        : null;
    // Merge business data into user so app-shell can read user.businesses[0].extra_data
    const businessData = payload.business && typeof payload.business === "object"
      ? (payload.business as Record<string, unknown>)
      : null;
    const user = rawUser
      ? { ...rawUser, businesses: businessData ? [businessData] : [] }
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
    const isOwner =
      (payload.is_owner as boolean | undefined) ?? (payload.isOwner as boolean | undefined) ?? false;
    const permissionKeys = Array.isArray(payload.permission_keys)
      ? (payload.permission_keys as string[])
      : Array.isArray((payload as { permissionKeys?: string[] }).permissionKeys)
        ? ((payload as { permissionKeys: string[] }).permissionKeys)
        : [];

    const state = useAuthStore.getState();
    state.setAccessToken(accessToken);
    state.setUser(user);
    state.setOnboardingRequired(Boolean(onboardingRequired));
    state.setDefaultBusinessId(
      typeof defaultBusinessId === "number" ? defaultBusinessId : null
    );
    state.setDefaultRole(defaultRole);
    state.setHasActiveBusinessAccess(Boolean(hasActiveBusinessAccess));
    state.setIsOwner(Boolean(isOwner));
    state.setPermissionKeys(permissionKeys);

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

  const method = (rest.method ?? 'GET').toUpperCase();
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

  // Dev logging — surfaces unexpected/repeated calls in the browser console
  logApiCall(method, url);

  // ------------------------------------------------------------------
  // In-flight GET deduplication
  // If an identical GET is already in-flight, piggyback on it instead
  // of making a second network request.
  // ------------------------------------------------------------------
  if (method === 'GET') {
    const state = useAuthStore.getState();
    const dedupeKey = `${url}||${state.accessToken ?? ''}`;
    const existing = inflightGets.get(dedupeKey);
    if (existing) {
      return existing as Promise<T>;
    }
  }

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

  // Build deduplication key for GET requests
  const dedupeKey = method === 'GET' ? `${url}||${token ?? ''}` : null;

  // Core fetch logic — wrapped so we can register the promise in inflightGets
  const doFetch = async (): Promise<T> => {
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
  };

  if (dedupeKey) {
    const promise = doFetch().finally(() => {
      inflightGets.delete(dedupeKey!);
    });
    inflightGets.set(dedupeKey, promise);
    return promise;
  }

  return doFetch();
}
