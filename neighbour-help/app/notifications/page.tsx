"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, CheckCircle, ChevronLeft, DollarSign, Star, Truck } from "lucide-react";
import type { Notification, NotificationEventType } from "@/app/types";
import { useRequireRole } from "@/app/lib/hooks/useRequireRole";
import {
  ensureStoredNotifications,
  writeStoredNotifications,
} from "@/app/lib/mock/notificationsMock";

const NOTIF_CONFIG: Record<
  NotificationEventType,
  { icon: React.ReactNode; bg: string; color: string }
> = {
  bid_received: {
    icon: <DollarSign className="w-4 h-4" />,
    bg: "bg-blue-50",
    color: "text-[#0B74FF]",
  },
  bid_accepted: {
    icon: <CheckCircle className="w-4 h-4" />,
    bg: "bg-green-50",
    color: "text-green-600",
  },
  handyman_arriving: {
    icon: <Truck className="w-4 h-4" />,
    bg: "bg-amber-50",
    color: "text-amber-600",
  },
  job_completed: {
    icon: <Star className="w-4 h-4" />,
    bg: "bg-purple-50",
    color: "text-purple-600",
  },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsPage() {
  const { authorized, loading } = useRequireRole(["homeowner", "handyman", "admin"]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    setNotifications(ensureStoredNotifications());
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      writeStoredNotifications(next);
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      writeStoredNotifications(next);
      return next;
    });
  }, []);

  if (loading || !authorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-sm text-[#6B7280] hover:text-[#111827] mb-2"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </Link>
            <h1 className="text-2xl font-bold text-[#111827]">All Notifications</h1>
            <p className="text-sm text-[#6B7280] mt-1">{unreadCount} unread</p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-sm font-medium text-[#0B74FF] hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden">
          {notifications.length === 0 ? (
            <div className="p-12 text-center text-[#9CA3AF]">
              <Bell className="w-9 h-9 mx-auto mb-3" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F3F4F6]">
              {notifications.map((notif) => {
                const cfg = NOTIF_CONFIG[notif.type];
                return (
                  <div
                    key={notif.id}
                    onClick={() => markAsRead(notif.id)}
                    className={`flex items-start gap-3 px-5 py-4 hover:bg-[#F7F8FA] transition-colors cursor-pointer ${
                      !notif.read ? "bg-blue-50/40" : ""
                    }`}
                  >
                    <div
                      className={`w-9 h-9 ${cfg.bg} ${cfg.color} rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5`}
                    >
                      {cfg.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm leading-snug ${
                          notif.read ? "text-[#374151]" : "text-[#111827] font-medium"
                        }`}
                      >
                        {notif.message}
                      </p>
                      <p className="text-xs text-[#9CA3AF] mt-1">{timeAgo(notif.createdAt)}</p>
                    </div>

                    {!notif.read && (
                      <div className="w-2 h-2 rounded-full bg-[#0B74FF] flex-shrink-0 mt-2" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
