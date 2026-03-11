"use client";

import { X, DollarSign, CheckCircle, Truck, Star, Bell } from "lucide-react";
import type { Notification, NotificationEventType } from "@/app/types";

// ─── Mock data — replace with: fetch /api/notifications ──────────────────────
const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    type: "bid_received",
    message: 'Mike Rahman placed a bid of RM 95 on "Leaky kitchen faucet"',
    read: false,
    createdAt: new Date(Date.now() - 12 * 60_000).toISOString(),
    relatedJobId: "1",
  },
  {
    id: "n2",
    type: "bid_received",
    message: 'David Lim placed a bid of RM 120 on "Leaky kitchen faucet"',
    read: false,
    createdAt: new Date(Date.now() - 35 * 60_000).toISOString(),
    relatedJobId: "1",
  },
  {
    id: "n3",
    type: "handyman_arriving",
    message: "Ahmad Faris is on his way and will arrive in ~20 minutes.",
    read: true,
    createdAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    relatedJobId: "2",
  },
  {
    id: "n4",
    type: "bid_accepted",
    message: 'Your bid on "Ceiling fan installation" has been accepted!',
    read: true,
    createdAt: new Date(Date.now() - 5 * 3_600_000).toISOString(),
    relatedJobId: "11",
  },
  {
    id: "n5",
    type: "job_completed",
    message:
      '"Cabinet door hinge replacement" has been marked as completed. Please leave a review.',
    read: true,
    createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    relatedJobId: "3",
  },
];

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

interface NotificationsPanelProps {
  onClose: () => void;
}

export default function NotificationsPanel({
  onClose,
}: NotificationsPanelProps) {
  const unreadCount = MOCK_NOTIFICATIONS.filter((n) => !n.read).length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/25 z-40 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Slide-out panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-white border-l border-[#E5E7EB] shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#111827]" />
            <h2 className="text-base font-bold text-[#111827]">
              Notifications
            </h2>
            {unreadCount > 0 && (
              <span className="bg-[#0B74FF] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button className="text-xs text-[#0B74FF] hover:underline font-medium">
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F7F8FA] hover:text-[#111827] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto">
          {MOCK_NOTIFICATIONS.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[#9CA3AF] gap-3">
              <Bell className="w-10 h-10" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F3F4F6]">
              {MOCK_NOTIFICATIONS.map((notif) => {
                const cfg = NOTIF_CONFIG[notif.type];
                return (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-3 px-5 py-4 hover:bg-[#F7F8FA] transition-colors cursor-pointer ${
                      !notif.read ? "bg-blue-50/40" : ""
                    }`}
                  >
                    {/* Icon */}
                    <div
                      className={`w-9 h-9 ${cfg.bg} ${cfg.color} rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5`}
                    >
                      {cfg.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm leading-snug ${
                          notif.read
                            ? "text-[#374151]"
                            : "text-[#111827] font-medium"
                        }`}
                      >
                        {notif.message}
                      </p>
                      <p className="text-xs text-[#9CA3AF] mt-1">
                        {timeAgo(notif.createdAt)}
                      </p>
                    </div>

                    {/* Unread dot */}
                    {!notif.read && (
                      <div className="w-2 h-2 rounded-full bg-[#0B74FF] flex-shrink-0 mt-2" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#E5E7EB]">
          <button className="w-full text-center text-sm text-[#0B74FF] hover:underline font-medium py-1">
            View all notifications
          </button>
        </div>
      </div>
    </>
  );
}
