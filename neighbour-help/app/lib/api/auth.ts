import {
  AuthResponse,
  ChangePasswordRequest,
  LoginRequest,
  RegisterRequest,
  UpdateProfileRequest,
  UpdateUserSettingsRequest,
  User,
  UserSettings,
} from "@/app/types";
import { ApiClientError, apiClient, clearTokens, setTokens } from "./client";
import { mockAuthService } from "@/app/lib/mock/authMock";

function shouldUseMockAuth(error?: unknown): boolean {
  if (typeof window === "undefined") return false;

  if (process.env.NEXT_PUBLIC_USE_MOCK_AUTH === "true") {
    return true;
  }

  if (error instanceof TypeError || error instanceof SyntaxError) {
    return true;
  }

  if (error instanceof ApiClientError && error.statusCode >= 500) {
    return true;
  }

  return false;
}

function toClientError(message: string): Error {
  return new Error(message);
}

function useMockAuthDirectly(): boolean {
  return (
    typeof window !== "undefined" &&
    process.env.NEXT_PUBLIC_USE_MOCK_AUTH === "true"
  );
}

export const authService = {
  /**
   * POST /api/auth/login
   * Exchanges credentials for JWT tokens and persists them.
   */
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    if (useMockAuthDirectly()) {
      const response = mockAuthService.login(credentials);
      setTokens(response.tokens.accessToken, response.tokens.refreshToken);
      return response;
    }

    try {
      const response = await apiClient.post<AuthResponse>(
        "/auth/login",
        credentials,
        { authenticated: false }
      );
      setTokens(response.tokens.accessToken, response.tokens.refreshToken);
      return response;
    } catch (error) {
      if (!shouldUseMockAuth(error)) throw error;

      try {
        const response = mockAuthService.login(credentials);
        setTokens(response.tokens.accessToken, response.tokens.refreshToken);
        return response;
      } catch (mockError) {
        throw toClientError(
          mockError instanceof Error ? mockError.message : "Unable to sign in."
        );
      }
    }
  },

  /**
   * POST /api/auth/register
   * Creates a new account and returns tokens.
   */
  async register(data: RegisterRequest): Promise<AuthResponse> {
    if (useMockAuthDirectly()) {
      const response = mockAuthService.register(data);
      setTokens(response.tokens.accessToken, response.tokens.refreshToken);
      return response;
    }

    try {
      const response = await apiClient.post<AuthResponse>(
        "/auth/register",
        data,
        { authenticated: false }
      );
      setTokens(response.tokens.accessToken, response.tokens.refreshToken);
      return response;
    } catch (error) {
      if (!shouldUseMockAuth(error)) throw error;

      try {
        const response = mockAuthService.register(data);
        setTokens(response.tokens.accessToken, response.tokens.refreshToken);
        return response;
      } catch (mockError) {
        throw toClientError(
          mockError instanceof Error
            ? mockError.message
            : "Unable to create account."
        );
      }
    }
  },

  /**
   * GET /api/auth/me
   * Returns the currently authenticated user.
   */
  async getMe(): Promise<User> {
    if (useMockAuthDirectly()) {
      return mockAuthService.getMe();
    }

    try {
      return await apiClient.get<User>("/auth/me");
    } catch (error) {
      if (!shouldUseMockAuth(error)) throw error;
      return mockAuthService.getMe();
    }
  },

  /**
   * PATCH /api/account/profile
   * Updates editable profile fields for current user.
   */
  async updateProfile(data: UpdateProfileRequest): Promise<User> {
    if (useMockAuthDirectly()) {
      return mockAuthService.updateProfile(data);
    }

    try {
      return await apiClient.patch<User>("/account/profile", data);
    } catch (error) {
      if (!shouldUseMockAuth(error)) throw error;
      return mockAuthService.updateProfile(data);
    }
  },

  /**
   * POST /api/account/change-password
   * Changes password for currently authenticated user.
   */
  async changePassword(data: ChangePasswordRequest): Promise<void> {
    if (useMockAuthDirectly()) {
      mockAuthService.changePassword(data);
      return;
    }

    try {
      await apiClient.post<void>("/account/change-password", data);
    } catch (error) {
      if (!shouldUseMockAuth(error)) throw error;
      mockAuthService.changePassword(data);
    }
  },

  /**
   * GET /api/account/settings
   * Returns settings for currently authenticated user.
   */
  async getSettings(): Promise<UserSettings> {
    if (useMockAuthDirectly()) {
      return mockAuthService.getSettings();
    }

    try {
      return await apiClient.get<UserSettings>("/account/settings");
    } catch (error) {
      if (!shouldUseMockAuth(error)) throw error;
      return mockAuthService.getSettings();
    }
  },

  /**
   * PATCH /api/account/settings
   * Updates user settings.
   */
  async updateSettings(data: UpdateUserSettingsRequest): Promise<UserSettings> {
    if (useMockAuthDirectly()) {
      return mockAuthService.updateSettings(data);
    }

    try {
      return await apiClient.patch<UserSettings>("/account/settings", data);
    } catch (error) {
      if (!shouldUseMockAuth(error)) throw error;
      return mockAuthService.updateSettings(data);
    }
  },

  /**
   * POST /api/auth/logout
   * Invalidates the refresh token server-side then clears local storage.
   */
  async logout(): Promise<void> {
    if (useMockAuthDirectly()) {
      mockAuthService.logout();
      clearTokens();
      return;
    }

    try {
      try {
        await apiClient.post("/auth/logout", {});
      } catch (error) {
        if (shouldUseMockAuth(error)) {
          mockAuthService.logout();
        } else {
          throw error;
        }
      }
    } finally {
      clearTokens();
    }
  },

  /**
   * POST /api/auth/refresh
   * Exchanges a refresh token for a new access token.
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>(
      "/auth/refresh",
      { refreshToken },
      { authenticated: false }
    );
    setTokens(response.tokens.accessToken, response.tokens.refreshToken);
    return response;
  },

  resetMockData(): void {
    if (typeof window === "undefined") return;
    mockAuthService.reset();
    clearTokens();
  },
};
