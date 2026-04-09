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

function buildDefaultSettings(role: User["role"]): UserSettings {
  const base: UserSettings = {
    notifications: {
      emailBidUpdates: true,
      emailJobUpdates: true,
      productAnnouncements: false,
    },
    privacy: {
      showProfileToPublic: false,
      sharePreciseLocation: false,
    },
  };

  if (role === "homeowner") {
    base.homeowner = {
      defaultEmergency: false,
      preferredContactMethod: "email",
    };
  }

  if (role === "handyman") {
    base.handyman = {
      serviceRadiusKm: 10,
      acceptingNewJobs: true,
      categories: ["General Maintenance"],
    };
  }

  return base;
}

function mergeSettings(
  current: UserSettings,
  updates: UpdateUserSettingsRequest
): UserSettings {
  return {
    ...current,
    notifications: {
      ...current.notifications,
      ...updates.notifications,
    },
    privacy: {
      ...current.privacy,
      ...updates.privacy,
    },
    homeowner: updates.homeowner
      ? {
          ...(current.homeowner ?? {
            defaultEmergency: false,
            preferredContactMethod: "email" as const,
          }),
          ...updates.homeowner,
        }
      : current.homeowner,
    handyman: updates.handyman
      ? {
          ...(current.handyman ?? {
            serviceRadiusKm: 10,
            acceptingNewJobs: true,
            categories: ["General Maintenance"],
          }),
          ...updates.handyman,
        }
      : current.handyman,
  };
}

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
   * Account profile write endpoint is not part of current backend v1 API.
   * Returns the latest profile shape merged with requested edits for UI continuity.
   */
  async updateProfile(data: UpdateProfileRequest): Promise<User> {
    const user = await apiClient.get<User>("/auth/me");
    return {
      ...user,
      name: data.name ?? user.name,
      avatarUrl: data.avatarUrl ?? user.avatarUrl,
    };
  },

  /**
   * Password change endpoint is not available in the current backend API surface.
   */
  async changePassword(data: ChangePasswordRequest): Promise<void> {
    void data;
    throw new Error(
      "Password change is not available yet. Current backend plan does not expose /api/account/change-password."
    );
  },

  /**
   * Backend v1 plan does not expose /api/account/settings.
   * Reroute to /api/auth/me and derive per-role default settings.
   */
  async getSettings(): Promise<UserSettings> {
    const user = await apiClient.get<User>("/auth/me");
    return buildDefaultSettings(user.role);
  },

  /**
   * Backend v1 plan does not expose /api/account/settings write endpoint.
   * Returns merged settings locally for now.
   */
  async updateSettings(data: UpdateUserSettingsRequest): Promise<UserSettings> {
    const user = await apiClient.get<User>("/auth/me");
    const current = buildDefaultSettings(user.role);
    return mergeSettings(current, data);
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
