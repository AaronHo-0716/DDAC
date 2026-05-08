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

export interface BlobResponse {
  blob: Blob;
  fileName?: string;
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
  if (typeof window === "undefined") return;
  
  // Only clear and emit if there was actually something to clear
  if (localStorage.getItem(TOKEN_KEY)) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.dispatchEvent(new Event("nh_unauthorized"));
  }
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

export class ApiClientError extends Error {
  statusCode: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.statusCode = status;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const rawText = await response.text();
  let data: any = null;

  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = { message: rawText };
  }

  if (!response.ok) {
    throw new ApiClientError(response.status, data?.detail || data?.message || "Request failed");
  }
  return data as T;
}

// ─── Token Refresh Logic ─────────────────────────────────────────────────────

async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) throw new Error("Refresh failed");

      const data = (await response.json()) as RefreshResponse;
      if (!data.tokens?.accessToken || !data.tokens?.refreshToken) throw new Error("Invalid tokens");

      setTokens(data.tokens.accessToken, data.tokens.refreshToken);
      return data.tokens.accessToken;
    } catch {
      clearTokens(); // 🛑 Stop the loop by clearing everything
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit & { authenticated?: boolean; _isRetry?: boolean } = {}
): Promise<T> {
  const { authenticated = true, _isRetry = false, ...fetchOptions } = options;
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

  const headers = new Headers(fetchOptions.headers);
  headers.set("Accept", "application/json");
  if (!(fetchOptions.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (authenticated) {
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, { ...fetchOptions, headers, cache: "no-store" });

  // 🔄 Handle 401 with Retry Logic
  if (response.status === 401 && authenticated && !_isRetry && path !== "/auth/refresh") {
    const newToken = await refreshAccessToken();
    if (newToken) {
      // Retry exactly once with the new token
      return request<T>(path, { ...options, _isRetry: true });
    }
  }

  // If we reach here and it's still 401, the user is definitely blocked or logged out
  if (response.status === 401 && path !== "/auth/refresh") {
    clearTokens();
  }

  return parseResponse<T>(response);
}

// ─── Blob request (For File Downloads) ───────────────────────────────────────

async function requestBlob(
  path: string,
  options: RequestInit & { authenticated?: boolean; _isRetry?: boolean } = {}
): Promise<BlobResponse> {
  const { authenticated = true, _isRetry = false, ...fetchOptions } = options;
  const url = `${API_BASE_URL}${path}`;

  const headers = new Headers(fetchOptions.headers);
  if (authenticated) {
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, { ...fetchOptions, headers, cache: "no-store" });

  if (response.status === 401 && authenticated && !_isRetry && path !== "/auth/refresh") {
    const newToken = await refreshAccessToken();
    if (newToken) return requestBlob(path, { ...options, _isRetry: true });
  }

  if (!response.ok) await parseResponse(response);

  const disposition = response.headers.get("Content-Disposition");
  let fileName = undefined;
  if (disposition) {
    const match = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
    if (match?.[1]) fileName = match[1].replace(/['"]/g, "");
  }

  return { blob: await response.blob(), fileName };
}

// ─── Convenience methods ──────────────────────────────────────────────────────

export const apiClient = {
  get: <T>(p: string, o?: any) => request<T>(p, { method: "GET", ...o }),
  post: <T>(p: string, b: any, o?: any) => request<T>(p, { method: "POST", body: JSON.stringify(b), ...o }),
  postForm: <T>(p: string, f: FormData, o?: any) => request<T>(p, { method: "POST", body: f, ...o }),
  put: <T>(p: string, b: any, o?: any) => request<T>(p, { method: "PUT", body: JSON.stringify(b), ...o }),
  patch: <T>(p: string, b: any, o?: any) => request<T>(p, { method: "PATCH", body: JSON.stringify(b), ...o }),
  delete: <T>(p: string, o?: any) => request<T>(p, { method: "DELETE", ...o }),
  getBlob: (p: string, o?: any) => requestBlob(p, { method: "GET", ...o }),
};