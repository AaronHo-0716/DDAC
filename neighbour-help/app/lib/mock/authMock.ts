import type { AuthResponse, LoginRequest, RegisterRequest, User } from "@/app/types";

interface StoredMockUser extends User {
  password: string;
}

interface MockAuthStore {
  users: StoredMockUser[];
  currentUserId: string | null;
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
  ];
}

function getDefaultStore(): MockAuthStore {
  return {
    users: createSeedUsers(),
    currentUserId: null,
  };
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

    if (!Array.isArray(parsed.users) || typeof parsed.currentUserId === "undefined") {
      throw new Error("Invalid mock auth store shape");
    }

    return parsed;
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

  reset(): void {
    const store = getDefaultStore();
    writeStore(store);
  },
};
