import type {
  AuthResponse,
  ChangePasswordRequest,
  JobCategory,
  LoginRequest,
  RegisterRequest,
  UpdateProfileRequest,
  UpdateUserSettingsRequest,
  User,
  UserSettings,
} from "@/app/types";

interface StoredMockUser extends User {
  password: string;
}

interface MockAuthStore {
  users: StoredMockUser[];
  currentUserId: string | null;
  settingsByUserId: Record<string, UserSettings>;
}

const MOCK_AUTH_STORE_KEY = "nh_mock_auth_store";

const nowIso = () => new Date().toISOString();

function createSeedUsers(): StoredMockUser[] {
  const createdAt = nowIso();

  return [
    {
      id: "mock-homeowner-1",
      name: "Demo Homeowner",
      email: "homeowner@neighborhelp.test",
      role: "homeowner",
      createdAt,
      password: "Password123!",
      avatarUrl: "",
      rating: undefined,
    },
    {
      id: "mock-handyman-1",
      name: "Demo Handyman",
      email: "handyman@neighborhelp.test",
      role: "handyman",
      createdAt,
      password: "Password123!",
      avatarUrl: "",
      rating: 4.8,
    },
    {
      id: "mock-admin-1",
      name: "Demo Admin",
      email: "admin@neighborhelp.test",
      role: "admin",
      createdAt,
      password: "Password123!",
      avatarUrl: "",
      rating: undefined,
    },
  ];
}

function getDefaultStore(): MockAuthStore {
  const users = createSeedUsers();

  return {
    users,
    currentUserId: null,
    settingsByUserId: users.reduce<Record<string, UserSettings>>((acc, user) => {
      acc[user.id] = createDefaultSettings(user.role);
      return acc;
    }, {}),
  };
}

function createDefaultSettings(role: User["role"]): UserSettings {
  const base: UserSettings = {
    notifications: {
      emailBidUpdates: true,
      emailJobUpdates: true,
      productAnnouncements: false,
    },
    privacy: {
      showProfileToPublic: role === "handyman",
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

function mergeCategories(categories: JobCategory[] | undefined): JobCategory[] | undefined {
  if (!categories) return undefined;

  const unique = Array.from(new Set(categories));
  if (unique.length === 0) return ["General Maintenance"];

  return unique;
}

function mergeSeedUsers(existingUsers: StoredMockUser[]): StoredMockUser[] {
  const seedUsers = createSeedUsers();
  const byEmail = new Map<string, StoredMockUser>();

  existingUsers.forEach((user) => {
    byEmail.set(user.email.toLowerCase(), user);
  });

  // Backfill newly introduced seed accounts (for example admin user)
  seedUsers.forEach((seed) => {
    const key = seed.email.toLowerCase();
    if (!byEmail.has(key)) {
      byEmail.set(key, seed);
    }
  });

  return Array.from(byEmail.values());
}

function readStore(): MockAuthStore {
  if (typeof window === "undefined") return getDefaultStore();

  const raw = localStorage.getItem(MOCK_AUTH_STORE_KEY);
  if (!raw) {
    const seeded = getDefaultStore();
    localStorage.setItem(MOCK_AUTH_STORE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as MockAuthStore;

    if (
      !Array.isArray(parsed.users) ||
      typeof parsed.currentUserId === "undefined" ||
      typeof parsed.settingsByUserId !== "object"
    ) {
      throw new Error("Invalid mock auth store shape");
    }

    const mergedUsers = mergeSeedUsers(parsed.users);
    const mergedStore: MockAuthStore = {
      ...parsed,
      users: mergedUsers,
      settingsByUserId: { ...parsed.settingsByUserId },
    };

    mergedUsers.forEach((user) => {
      if (!mergedStore.settingsByUserId[user.id]) {
        mergedStore.settingsByUserId[user.id] = createDefaultSettings(user.role);
      }
    });

    // Persist migration so users only pay merge cost once.
    localStorage.setItem(MOCK_AUTH_STORE_KEY, JSON.stringify(mergedStore));

    return mergedStore;
  } catch {
    const reset = getDefaultStore();
    localStorage.setItem(MOCK_AUTH_STORE_KEY, JSON.stringify(reset));
    return reset;
  }
}

function writeStore(store: MockAuthStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MOCK_AUTH_STORE_KEY, JSON.stringify(store));
}

function toPublicUser(user: StoredMockUser): User {
  const { password: _password, ...publicUser } = user;
  return publicUser;
}

function fakeTokens() {
  return {
    accessToken: `mock_access_${Math.random().toString(36).slice(2)}`,
    refreshToken: `mock_refresh_${Math.random().toString(36).slice(2)}`,
    expiresIn: 60 * 60,
  };
}

export const mockAuthService = {
  login(credentials: LoginRequest): AuthResponse {
    const store = readStore();
    const matchedUser = store.users.find(
      (user) =>
        user.email.toLowerCase() === credentials.email.trim().toLowerCase() &&
        user.password === credentials.password
    );

    if (!matchedUser) {
      throw new Error("Invalid email or password.");
    }

    store.currentUserId = matchedUser.id;
    writeStore(store);

    return {
      user: toPublicUser(matchedUser),
      tokens: fakeTokens(),
    };
  },

  register(data: RegisterRequest): AuthResponse {
    const store = readStore();
    const email = data.email.trim().toLowerCase();

    const existing = store.users.find((user) => user.email.toLowerCase() === email);
    if (existing) {
      throw new Error("An account with this email already exists.");
    }

    const createdAt = nowIso();
    const newUser: StoredMockUser = {
      id: `mock-${data.role}-${Date.now()}`,
      name: data.name.trim(),
      email,
      role: data.role,
      createdAt,
      password: data.password,
      avatarUrl: "",
      rating: data.role === "handyman" ? 5 : undefined,
    };

    store.users.push(newUser);
    store.currentUserId = newUser.id;
  store.settingsByUserId[newUser.id] = createDefaultSettings(newUser.role);
    writeStore(store);

    return {
      user: toPublicUser(newUser),
      tokens: fakeTokens(),
    };
  },

  getMe(): User {
    const store = readStore();

    if (!store.currentUserId) {
      throw new Error("Not authenticated.");
    }

    const currentUser = store.users.find((user) => user.id === store.currentUserId);
    if (!currentUser) {
      throw new Error("Session not found.");
    }

    return toPublicUser(currentUser);
  },

  logout(): void {
    const store = readStore();
    store.currentUserId = null;
    writeStore(store);
  },

  updateProfile(data: UpdateProfileRequest): User {
    const store = readStore();

    if (!store.currentUserId) {
      throw new Error("Not authenticated.");
    }

    const index = store.users.findIndex((user) => user.id === store.currentUserId);
    if (index < 0) {
      throw new Error("Session not found.");
    }

    const currentUser = store.users[index];
    const nextName = typeof data.name === "string" ? data.name.trim() : currentUser.name;

    if (nextName.length === 0) {
      throw new Error("Name cannot be empty.");
    }

    const updated: StoredMockUser = {
      ...currentUser,
      name: nextName,
      avatarUrl:
        typeof data.avatarUrl === "string" ? data.avatarUrl.trim() : currentUser.avatarUrl,
    };

    store.users[index] = updated;
    writeStore(store);

    return toPublicUser(updated);
  },

  changePassword(data: ChangePasswordRequest): void {
    const store = readStore();

    if (!store.currentUserId) {
      throw new Error("Not authenticated.");
    }

    const index = store.users.findIndex((user) => user.id === store.currentUserId);
    if (index < 0) {
      throw new Error("Session not found.");
    }

    const currentUser = store.users[index];
    if (currentUser.password !== data.currentPassword) {
      throw new Error("Current password is incorrect.");
    }

    if (data.newPassword.length < 8) {
      throw new Error("New password must be at least 8 characters.");
    }

    store.users[index] = {
      ...currentUser,
      password: data.newPassword,
    };

    writeStore(store);
  },

  getSettings(): UserSettings {
    const store = readStore();

    if (!store.currentUserId) {
      throw new Error("Not authenticated.");
    }

    const currentUser = store.users.find((user) => user.id === store.currentUserId);
    if (!currentUser) {
      throw new Error("Session not found.");
    }

    return (
      store.settingsByUserId[currentUser.id] ?? createDefaultSettings(currentUser.role)
    );
  },

  updateSettings(data: UpdateUserSettingsRequest): UserSettings {
    const store = readStore();

    if (!store.currentUserId) {
      throw new Error("Not authenticated.");
    }

    const currentUser = store.users.find((user) => user.id === store.currentUserId);
    if (!currentUser) {
      throw new Error("Session not found.");
    }

    const current =
      store.settingsByUserId[currentUser.id] ?? createDefaultSettings(currentUser.role);

    const next: UserSettings = {
      ...current,
      notifications: {
        ...current.notifications,
        ...(data.notifications ?? {}),
      },
      privacy: {
        ...current.privacy,
        ...(data.privacy ?? {}),
      },
      homeowner: current.homeowner
        ? {
            ...current.homeowner,
            ...(data.homeowner ?? {}),
          }
        : undefined,
      handyman: current.handyman
        ? {
            ...current.handyman,
            ...(data.handyman ?? {}),
            categories: mergeCategories(data.handyman?.categories) ?? current.handyman.categories,
          }
        : undefined,
    };

    store.settingsByUserId[currentUser.id] = next;
    writeStore(store);

    return next;
  },

  reset(): void {
    const store = getDefaultStore();
    writeStore(store);
  },
};
