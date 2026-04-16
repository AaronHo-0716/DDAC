import type {
  Notification,
  NotificationEventType,
  NotificationListResponse,
} from "@/app/types";
import { apiClient } from "./client";

interface RawNotificationDto {
  id?: string | null;
  type?: string | null;
  message?: string | null;
  relatedJobId?: string | null;
  isRead?: boolean | null;
  createdAtUtc?: string | null;
}

interface RawNotificationListResponse {
  data?: RawNotificationDto[] | null; 
  unreadCount?: number | null;
  totalCount?: number | null;
  page?: number | null;
  pageSize?: number | null;
}

const KNOWN_NOTIFICATION_TYPES: NotificationEventType[] = [
  "bid_received",
  "bid_rejected",
  "bid_accepted",
  "handyman_arriving",
  "job_completed",
  "system",
];

function normalizeNotificationType(value?: string | null): NotificationEventType {
  const normalized = (value ?? "").toLowerCase();
  if (KNOWN_NOTIFICATION_TYPES.includes(normalized as NotificationEventType)) {
    return normalized as NotificationEventType;
  }
  return "system";
}

function normalizeNotification(row: RawNotificationDto): Notification {
  return {
    id: row.id ?? "",
    type: normalizeNotificationType(row.type),
    message: row.message ?? "",
    read: !!row.isRead,
    createdAt: row.createdAtUtc ?? new Date(0).toISOString(),
    relatedJobId: row.relatedJobId ?? undefined,
  };
}

function normalizeListResponse(raw: RawNotificationListResponse): NotificationListResponse {
  const notifications = Array.isArray(raw.data)
    ? raw.data.map(normalizeNotification)
    : [];

  const derivedUnreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount: typeof raw.unreadCount === "number" ? raw.unreadCount : derivedUnreadCount,
    totalCount: raw.totalCount ?? 0,
    page: raw.page ?? 1,
    pageSize: raw.pageSize ?? 10
  } as NotificationListResponse; 
}

export const notificationsService = {
  async getNotifications(page = 1, pageSize = 1000): Promise<NotificationListResponse> {
    const response = await apiClient.get<RawNotificationListResponse>(
      `/notifications?page=${page}&pageSize=${pageSize}`
    );
    return normalizeListResponse(response);
  },

  async markAsRead(notificationId: string): Promise<void> {
    await apiClient.patch(`/notifications/${notificationId}/read`, {});
  },

  async markAllAsRead(): Promise<void> {
    await apiClient.patch("/notifications/read-all", {});
  },
};
