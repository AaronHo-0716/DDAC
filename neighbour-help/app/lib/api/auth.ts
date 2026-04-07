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
import { apiClient, clearTokens, setTokens } from "./client";

export const authService = {
  /**
   * POST /api/auth/login
   * Exchanges credentials for JWT tokens and persists them.
   */
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>(
      "/auth/login",
      credentials,
      { authenticated: false }
    );
    setTokens(response.tokens.accessToken, response.tokens.refreshToken);
    return response;
  },

  /**
   * POST /api/auth/register
   * Creates a new account and returns tokens.
   */
  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>(
      "/auth/register",
      data,
      { authenticated: false }
    );
    setTokens(response.tokens.accessToken, response.tokens.refreshToken);
    return response;
  },

  /**
   * GET /api/auth/me
   * Returns the currently authenticated user.
   */
  async getMe(): Promise<User> {
    return apiClient.get<User>("/auth/me");
  },

  /**
   * PATCH /api/account/profile
   * Updates editable profile fields for current user.
   */
  async updateProfile(data: UpdateProfileRequest): Promise<User> {
    return apiClient.patch<User>("/account/profile", data);
  },

  /**
   * POST /api/account/change-password
   * Changes password for currently authenticated user.
   */
  async changePassword(data: ChangePasswordRequest): Promise<void> {
    await apiClient.post<void>("/account/change-password", data);
  },

  /**
   * GET /api/account/settings
   * Returns settings for currently authenticated user.
   */
  async getSettings(): Promise<UserSettings> {
    return apiClient.get<UserSettings>("/account/settings");
  },

  /**
   * PATCH /api/account/settings
   * Updates user settings.
   */
  async updateSettings(data: UpdateUserSettingsRequest): Promise<UserSettings> {
    return apiClient.patch<UserSettings>("/account/settings", data);
  },

  /**
   * POST /api/auth/logout
   * Invalidates the refresh token server-side then clears local storage.
   */
  async logout(): Promise<void> {
    try {
      await apiClient.post("/auth/logout", {});
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
};
