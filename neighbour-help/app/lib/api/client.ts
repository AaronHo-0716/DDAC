import { ApiError } from "@/app/types";

/**
 * Routing strategy (Docker-friendly):
 *
 * ┌─ Browser (client components) ─────────────────────────────────────────────┐
 * │  Calls relative URL: /api/proxy/<path>                                     │
 * │  → Next.js rewrite (next.config.ts) proxies it to:                        │
 * │    ${API_URL}/api/<path>   (API_URL is a server-side env var)              │
 * │  The browser NEVER needs to know the backend's host.                       │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ Server (Route Handlers / Server Components) ──────────────────────────────┐
 * │  Calls directly: ${API_URL}/api/<path>                                     │
 * │  In Docker this resolves to the internal service name, e.g.                │
 * │  http://backend:5000/api/<path>  (set via docker-compose environment:)     │
 * └────────────────────────────────────────────────────────────────────────────┘
 */
const API_BASE_URL =
  typeof window === "undefined"
    ? // Server-side: call the backend directly (internal Docker network or localhost)
      `${process.env.API_URL ?? "http://localhost:5073"}/api`
    : // Client-side: relative path, proxied by Next.js rewrites — no URL baked in
      "/api/proxy";

const TOKEN_KEY = "nh_access_token";
const REFRESH_TOKEN_KEY = "nh_refresh_token";

interface RefreshResponse {
  tokens?: {
    accessToken?: string;
    refreshToken?: string;
  };
}

let refreshInFlight: Promise<string | null> | null = null;

// ─── Token helpers (localStorage — client-side only) ─────────────────────────

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

interface RequestOptions extends RequestInit {
  authenticated?: boolean;
}

export class ApiClientError extends Error {
  statusCode: number;
  errors?: Record<string, string[]>;

  constructor(apiError: ApiError) {
    super(apiError.message);
    this.name = "ApiClientError";
    this.statusCode = apiError.statusCode;
    this.errors = apiError.errors;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  // 204 No Content – return void
  if (response.status === 204) return undefined as T;

  const rawText = await response.text();
  let data: unknown = undefined;

  if (rawText.length > 0) {
    try {
      data = JSON.parse(rawText);
    } catch {
      // Backend may return plain text/HTML for 5xx errors. Normalize as ApiClientError.
      throw new ApiClientError({
        statusCode: response.status,
        message: rawText.length > 140 ? `${rawText.slice(0, 140)}...` : rawText,
      });
    }
  }

  if (!response.ok) {
    const apiError = data as Partial<ApiError> | undefined;
    throw new ApiClientError({
      statusCode: apiError?.statusCode ?? response.status,
      message: apiError?.message ?? response.statusText ?? "Request failed",
      errors: apiError?.errors,
    });
  }

  return data as T;
}

async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      clearTokens();
      return null;
    }

    const data = (await response.json()) as RefreshResponse;
    const accessToken = data.tokens?.accessToken;
    const newRefreshToken = data.tokens?.refreshToken;

    if (!accessToken || !newRefreshToken) {
      clearTokens();
      return null;
    }

    setTokens(accessToken, newRefreshToken);
    return accessToken;
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

async function request<T>(
  path: string,
  { authenticated = true, headers = {}, ...options }: RequestOptions = {},
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const resolvedHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string>),
  };

  if (authenticated) {
    const token = getAccessToken();
    if (token) resolvedHeaders["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers: resolvedHeaders,
  });

  const shouldAttemptRefresh =
    authenticated &&
    response.status === 401 &&
    typeof window !== "undefined" &&
    path !== "/auth/refresh";

  if (shouldAttemptRefresh) {
    const newAccessToken = await refreshAccessToken();
    if (newAccessToken) {
      const retryHeaders = {
        ...resolvedHeaders,
        Authorization: `Bearer ${newAccessToken}`,
      };

      const retryResponse = await fetch(url, {
        ...options,
        headers: retryHeaders,
      });

      return parseResponse<T>(retryResponse);
    }
  }

  return parseResponse<T>(response);
}

// ─── Convenience methods ──────────────────────────────────────────────────────

export const apiClient = {
  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>(path, { method: "GET", ...options });
  },

  post<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
      ...options,
    });
  },

  put<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
      ...options,
    });
  },

  patch<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body),
      ...options,
    });
  },

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>(path, { method: "DELETE", ...options });
  },
};
