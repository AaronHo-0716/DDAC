"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, ChevronDown, Wrench, Menu, X } from "lucide-react";
import { useAuth } from "@/app/lib/context/AuthContext";
import NotificationsPanel from "@/app/components/ui/NotificationsPanel";
import type { Notification } from "@/app/types";

const NOTIFICATIONS_STORAGE_KEY = "nh_mock_notifications";

function getUnreadCount(): number {
  if (typeof window === "undefined") return 0;

  const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
  if (!raw) return 0;

  try {
    const parsed = JSON.parse(raw) as Notification[];
    if (!Array.isArray(parsed)) return 0;
    return parsed.filter((n) => !n.read).length;
  } catch {
    return 0;
  }
}

const homeownerNavLinks = [
  { label: "My Jobs", href: "/my-jobs" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Post Job", href: "/create-job" },
];

const handymanNavLinks = [
  { label: "Browse Jobs", href: "/handyman" },
  { label: "My Bids", href: "/handyman/bids" },
  { label: "Active Jobs", href: "/handyman/active-jobs" },
];

const adminNavLinks = [
  { label: "Admin Dashboard", href: "/admin" },
  { label: "Bid Transactions", href: "/admin/transactions/bids" },
  { label: "Users", href: "/admin/users" },
];

export default function Navbar() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user, logout } = useAuth();
  const navLinks = user
    ? user.role === "handyman"
      ? handymanNavLinks
      : user.role === "admin"
      ? adminNavLinks
      : homeownerNavLinks
    : [];

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const refreshUnread = () => {
      setUnreadCount(getUnreadCount());
    };

    refreshUnread();
    window.addEventListener("nh_notifications_updated", refreshUnread);

    return () => {
      window.removeEventListener("nh_notifications_updated", refreshUnread);
    };
  }, [user]);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#E5E7EB] shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-[#0B74FF] rounded-lg flex items-center justify-center">
              <Wrench className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-[#111827] tracking-tight">
              Neighbor<span className="text-[#0B74FF]">Help</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-2 text-sm font-medium text-[#6B7280] hover:text-[#111827] hover:bg-[#F7F8FA] rounded-lg transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                {/* Notification Bell */}
                <button
                  onClick={() => setNotificationsOpen(true)}
                  className="relative w-9 h-9 flex items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F7F8FA] hover:text-[#111827] transition-colors"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#0B74FF] rounded-full" />
                  )}
                </button>

                {/* Avatar Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[#F7F8FA] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#0B74FF] text-white text-sm font-semibold flex items-center justify-center">
                      {user.name?.charAt(0).toUpperCase() ?? "U"}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-[#6B7280] transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-52 bg-white border border-[#E5E7EB] rounded-xl shadow-lg py-1 z-50">
                      <div className="px-4 py-2.5 border-b border-[#F3F4F6]">
                        <p className="text-sm font-semibold text-[#111827] truncate">{user.name}</p>
                        <p className="text-xs text-[#6B7280] truncate">{user.email}</p>
                      </div>
                      <Link href="/profile" className="block px-4 py-2.5 text-sm text-[#111827] hover:bg-[#F7F8FA] transition-colors">
                        Profile
                      </Link>
                      <Link href="/settings" className="block px-4 py-2.5 text-sm text-[#111827] hover:bg-[#F7F8FA] transition-colors">
                        Settings
                      </Link>
                      <button
                        onClick={() => { setDropdownOpen(false); logout(); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                      >
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm font-semibold text-[#0B74FF] hover:bg-blue-50 rounded-lg transition-colors"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#0B74FF] hover:bg-[#065ed1] rounded-lg transition-colors"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden w-9 h-9 flex items-center justify-center text-[#6B7280] hover:text-[#111827]"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Notifications Panel */}
      {notificationsOpen && (
        <NotificationsPanel onClose={() => setNotificationsOpen(false)} />
      )}

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[#E5E7EB] bg-white px-4 pt-2 pb-4 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block px-4 py-2.5 text-sm font-medium text-[#6B7280] hover:text-[#111827] hover:bg-[#F7F8FA] rounded-lg transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {!user && (
            <div className="border-t border-[#E5E7EB] pt-2 mt-2 flex items-center gap-3 px-4">
              <Link href="/login" className="text-sm text-[#0B74FF] font-medium hover:underline">
                Sign In
              </Link>
              <span className="text-[#E5E7EB]">|</span>
              <Link href="/register" className="text-sm text-[#0B74FF] font-medium hover:underline">
                Sign Up
              </Link>
            </div>
          )}
          {user && (
            <div className="border-t border-[#E5E7EB] pt-2 mt-2 space-y-1 px-4">
              <button
                onClick={() => {
                  setMobileOpen(false);
                  logout();
                }}
                className="block w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
