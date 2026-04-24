"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, DollarSign, CheckCircle, Truck, Star, Bell } from "lucide-react";
import { HubConnection, HubConnectionBuilder, LogLevel, HttpTransportType, HubConnectionState } from "@microsoft/signalr";
import type { Notification, NotificationEventType } from "@/app/types";
import { notificationsService } from "@/app/lib/api/notifications";
import { getAccessToken } from "@/app/lib/api/client";

const NOTIF_HUB_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
  "http://localhost:5073";
const NOTIF_HUB_URL = `${NOTIF_HUB_BASE_URL.replace(/\/+$/, "")}/api/notification-hub`;

const NOTIF_CONFIG: Record<
  NotificationEventType,
  { icon: React.ReactNode; bg: string; color: string }
> = {
  bid_received: { icon: <DollarSign className="w-4 h-4" />, bg: "bg-blue-50", color: "text-[#0B74FF]" },
  bid_rejected: { icon: <Bell className="w-4 h-4" />, bg: "bg-red-50", color: "text-red-600" },
  bid_accepted: { icon: <CheckCircle className="w-4 h-4" />, bg: "bg-green-50", color: "text-green-600" },
  handyman_arriving: { icon: <Truck className="w-4 h-4" />, bg: "bg-amber-50", color: "text-amber-600" },
  job_completed: { icon: <Star className="w-4 h-4" />, bg: "bg-purple-50", color: "text-purple-600" },
  system: { icon: <Bell className="w-4 h-4" />, bg: "bg-gray-100", color: "text-gray-700" },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface NotificationsPanelProps {
  onClose: () => void;
}

export default function NotificationsPanel({ onClose }: NotificationsPanelProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const connectionRef = useRef<HubConnection | null>(null);

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const response = await notificationsService.getNotifications();
      setNotifications(response.notifications || []);
    } catch {
      setError("Failed to load notifications.");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    let isSubscribed = true; 

    const connection = new HubConnectionBuilder()
      .withUrl(NOTIF_HUB_URL, {
        accessTokenFactory: () => token,
        withCredentials: true,
        skipNegotiation: true,
        transport: HttpTransportType.WebSockets,
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.None) 
      .build();

    connection.on("ReceiveNotification", (incoming: any) => {
      if (!isSubscribed) return;
      const newNotif: Notification = {
        id: incoming.id,
        type: incoming.type,
        message: incoming.message,
        read: incoming.isRead,
        createdAt: incoming.createdAtUtc,
        relatedJobId: incoming.relatedJobId
      };
      setNotifications((prev) => [newNotif, ...prev]);
    });

    connection.on("NotificationMarkedRead", (id: string) => {
      if (!isSubscribed) return;
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    });

    connection.on("AllNotificationsMarkedRead", () => {
      if (!isSubscribed) return;
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    });

    connectionRef.current = connection;

    const startConnection = async () => {
      try {
        // Double check state before starting
        if (isSubscribed && connection.state === HubConnectionState.Disconnected) {
          await connection.start();
        }
      } catch (err) {
        // If it was told to stop while starting, we ignore the error
        if (isSubscribed) {
          console.error("SignalR Connection Error:", err);
        }
      }
    };

    void startConnection();

    return () => {
      isSubscribed = false; 
      const conn = connectionRef.current;
      if (conn) {
        // FIX: Prevent calling stop() while in 'Connecting' state
        if (conn.state !== HubConnectionState.Disconnected && conn.state !== HubConnectionState.Connecting) {
          conn.stop().catch(() => { /* ignore teardown errors */ });
        } else if (conn.state === HubConnectionState.Connecting) {
            // If still connecting, SignalR doesn't like stop(). 
            // We just clear the reference and let it finish/timeout silently.
        }
        connectionRef.current = null;
      }
    };
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const markAsRead = useCallback((id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (!target || target.read) return;

    void (async () => {
      try {
        await notificationsService.markAsRead(id);
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        window.dispatchEvent(new Event("nh_notifications_updated"));
      } catch (err) {
        setError("Failed to update notification.");
      }
    })();
  }, [notifications]);

  const markAllAsRead = useCallback(() => {
    if (notifications.every((n) => n.read)) return;

    void (async () => {
      try {
        await notificationsService.markAllAsRead();
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        window.dispatchEvent(new Event("nh_notifications_updated"));
      } catch (err) {
        setError("Failed to mark all read.");
      }
    })();
  }, [notifications]);

  const handleViewAllNotifications = useCallback(() => {
    onClose();
    router.push("/notifications");
  }, [onClose, router]);

  return (
    <>
      <div className="fixed inset-0 bg-black/25 z-40 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-white border-l border-[#E5E7EB] shadow-xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#111827]" />
            <h2 className="text-base font-bold text-[#111827]">Notifications</h2>
            {unreadCount > 0 && (
              <span className="bg-[#0B74FF] text-white text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="text-xs text-[#0B74FF] hover:underline font-medium">Mark all read</button>
            )}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F7F8FA] hover:text-[#111827] transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {fetching ? (
            <div className="p-5 text-sm text-[#6B7280]">Loading...</div>
          ) : error ? (
            <div className="p-5 text-sm text-red-700">{error}</div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[#9CA3AF] gap-3">
              <Bell className="w-10 h-10" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F3F4F6]">
              {notifications.map((notif) => {
                const cfg = NOTIF_CONFIG[notif.type] || NOTIF_CONFIG.system;
                return (
                  <div
                    key={notif.id}
                    onClick={() => markAsRead(notif.id)}
                    className={`flex items-start gap-3 px-5 py-4 hover:bg-[#F7F8FA] transition-colors cursor-pointer ${!notif.read ? "bg-blue-50/40" : ""}`}
                  >
                    <div className={`w-9 h-9 ${cfg.bg} ${cfg.color} rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${notif.read ? "text-[#374151]" : "text-[#111827] font-medium"}`}>{notif.message}</p>
                      <p className="text-xs text-[#9CA3AF] mt-1">{timeAgo(notif.createdAt)}</p>
                    </div>
                    {!notif.read && <div className="w-2 h-2 rounded-full bg-[#0B74FF] flex-shrink-0 mt-2" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[#E5E7EB]">
          <button onClick={handleViewAllNotifications} className="w-full text-center text-sm text-[#0B74FF] hover:underline font-medium py-1">View all notifications</button>
        </div>
      </div>
    </>
  );
}