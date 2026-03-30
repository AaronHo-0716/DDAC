import type { Notification } from "@/app/types";

export const NOTIFICATIONS_STORAGE_KEY = "nh_mock_notifications";
const NOTIFICATIONS_RESET_VERSION_KEY = "nh_mock_notifications_reset_v1";

export const DEFAULT_NOTIFICATIONS: Notification[] = [];

function runResetMigration(): void {
  if (typeof window === "undefined") return;

  const alreadyReset = localStorage.getItem(NOTIFICATIONS_RESET_VERSION_KEY);
  if (alreadyReset === "1") return;

  localStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
  localStorage.setItem(NOTIFICATIONS_RESET_VERSION_KEY, "1");
}

export function readStoredNotifications(): Notification[] {
  if (typeof window === "undefined") return DEFAULT_NOTIFICATIONS;

  runResetMigration();

  const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
  if (!raw) return DEFAULT_NOTIFICATIONS;

  try {
    const parsed = JSON.parse(raw) as Notification[];
    if (!Array.isArray(parsed)) return DEFAULT_NOTIFICATIONS;
    return parsed;
  } catch {
    return DEFAULT_NOTIFICATIONS;
  }
}

export function writeStoredNotifications(notifications: Notification[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
  window.dispatchEvent(new Event("nh_notifications_updated"));
}

export function ensureStoredNotifications(): Notification[] {
  return readStoredNotifications();
}
