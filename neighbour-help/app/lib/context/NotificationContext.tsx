"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  HubConnection,
  HubConnectionBuilder,
  HttpTransportType,
  HubConnectionState,
  LogLevel,
} from "@microsoft/signalr";
import type { Notification } from "@/app/types";
import { notificationsService } from "@/app/lib/api/notifications";
import { getAccessToken } from "@/app/lib/api/client";
import { useAuth } from "@/app/lib/context/AuthContext";

const getNotificationHubBaseUrl = () => {
  const envBase =
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

  if (envBase) {
    return envBase;
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "http://localhost:5073";
};

const NOTIF_HUB_URL = `${getNotificationHubBaseUrl().replace(/\/+$|\s+/g, "")}/api/notification-hub`;

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  loaded: boolean;
  error: string | null;
  loadNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const connectionRef = useRef<HubConnection | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const response = await notificationsService.getNotifications();
      if (!mountedRef.current) return;
      setNotifications(response.notifications);
      setHasLoaded(true);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to load notifications.");
    } finally {
      if (!mountedRef.current) return;
      setLoading(false);
    }
  }, [user]);

  const markAsRead = useCallback(
    async (id: string) => {
      if (!user) return;

      try {
        await notificationsService.markAsRead(id);
        if (!mountedRef.current) return;
        setNotifications((prev) =>
          prev.map((notification) =>
            notification.id === id ? { ...notification, read: true } : notification,
          ),
        );
      } catch (err) {
        if (!mountedRef.current) return;
        setError(err instanceof Error ? err.message : "Failed to update notification.");
      }
    },
    [user],
  );

  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      await notificationsService.markAllAsRead();
      if (!mountedRef.current) return;
      setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to mark all notifications as read.");
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setHasLoaded(false);
      setError(null);
      return;
    }

    if (!authLoading && !hasLoaded) {
      void loadNotifications();
    }
  }, [user, authLoading, hasLoaded, loadNotifications]);

  useEffect(() => {
    if (!user) return;

    const token = getAccessToken();
    if (!token) return;

    let isSubscribed = true;

    const connection = new HubConnectionBuilder()
      .withUrl(NOTIF_HUB_URL, {
        accessTokenFactory: () => token,
        transport: HttpTransportType.WebSockets,
        skipNegotiation: true,
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    connection.on(
      "ReceiveNotification",
      (incoming: Partial<{
        id: string;
        type: Notification["type"];
        message: string;
        isRead: boolean;
        createdAtUtc: string;
        relatedJobId: string;
      }>) => {
        if (!isSubscribed) return;
        const newNotification: Notification = {
          id: incoming.id ?? crypto.randomUUID(),
          type: incoming.type ?? "system",
          message: incoming.message ?? "",
          read: incoming.isRead ?? false,
          createdAt: incoming.createdAtUtc ?? new Date().toISOString(),
          relatedJobId: incoming.relatedJobId,
        };
        setNotifications((prev) => [newNotification, ...prev]);
      },
    );

    connection.on("NotificationMarkedRead", (id: string) => {
      if (!isSubscribed) return;
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === id ? { ...notification, read: true } : notification,
        ),
      );
    });

    connection.on("AllNotificationsMarkedRead", () => {
      if (!isSubscribed) return;
      setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
    });

    connection.start().catch((err) => {
      if (!isSubscribed) return;
      console.error("[NotificationProvider] SignalR Connection Error:", err);
    });

    connectionRef.current = connection;

    return () => {
      isSubscribed = false;
      const conn = connectionRef.current;
      if (conn) {
        if (
          conn.state !== HubConnectionState.Disconnected &&
          conn.state !== HubConnectionState.Connecting
        ) {
          conn.stop().catch(() => {
            /* ignore teardown errors */
          });
        }
        connectionRef.current = null;
      }
    };
  }, [user]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        loaded: hasLoaded,
        error,
        loadNotifications,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used inside <NotificationProvider>");
  }
  return ctx;
}
