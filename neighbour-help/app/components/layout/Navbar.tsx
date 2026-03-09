"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, ChevronDown, Wrench, Menu, X } from "lucide-react";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "My Jobs", href: "/my-jobs" },
  { label: "Dashboard", href: "/dashboard" },
];

export default function Navbar() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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
            {/* Notification Bell */}
            <button className="relative w-9 h-9 flex items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F7F8FA] hover:text-[#111827] transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#0B74FF] rounded-full" />
            </button>

            {/* Avatar Dropdown */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[#F7F8FA] transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-[#0B74FF] text-white text-sm font-semibold flex items-center justify-center">
                  U
                </div>
                <ChevronDown className={`w-4 h-4 text-[#6B7280] transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-[#E5E7EB] rounded-xl shadow-lg py-1 z-50">
                  <Link href="/profile" className="block px-4 py-2.5 text-sm text-[#111827] hover:bg-[#F7F8FA] transition-colors">
                    Profile
                  </Link>
                  <Link href="/settings" className="block px-4 py-2.5 text-sm text-[#111827] hover:bg-[#F7F8FA] transition-colors">
                    Settings
                  </Link>
                  <div className="border-t border-[#E5E7EB] my-1" />
                  <Link href="/login" className="block px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors">
                    Sign Out
                  </Link>
                </div>
              )}
            </div>
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
          <div className="border-t border-[#E5E7EB] pt-2 mt-2 flex items-center gap-3 px-4">
            <Link href="/login" className="text-sm text-[#0B74FF] font-medium hover:underline">
              Sign In
            </Link>
            <span className="text-[#E5E7EB]">|</span>
            <Link href="/register" className="text-sm text-[#0B74FF] font-medium hover:underline">
              Sign Up
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
