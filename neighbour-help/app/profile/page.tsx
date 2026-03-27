"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Mail, Shield, Star, UserCircle2 } from "lucide-react";
import PrimaryButton from "@/app/components/ui/PrimaryButton";
import { useRequireRole } from "@/app/lib/hooks/useRequireRole";
import { useAuth } from "@/app/lib/context/AuthContext";
import { authService } from "@/app/lib/api/auth";

function formatJoinedDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "Unknown" : d.toLocaleDateString();
}

export default function ProfilePage() {
  const { authorized, loading, user } = useRequireRole([
    "homeowner",
    "handyman",
    "admin",
  ]);
  const { refreshUser } = useAuth();

  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    setAvatarUrl(user.avatarUrl ?? "");
  }, [user]);

  if (loading || !authorized || !user) {
    return null;
  }

  const hasChanges =
    name.trim() !== (user.name ?? "") || avatarUrl.trim() !== (user.avatarUrl ?? "");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges) return;

    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      await authService.updateProfile({
        name: name.trim(),
        avatarUrl: avatarUrl.trim(),
      });
      await refreshUser();
      setMessage("Profile updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update profile.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#111827]">My Profile</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Manage your public identity and personal account details.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-[#0B74FF] text-white flex items-center justify-center text-2xl font-bold mb-3">
                {user.name?.charAt(0).toUpperCase() ?? "U"}
              </div>
              <p className="text-base font-semibold text-[#111827]">{user.name}</p>
              <p className="text-sm text-[#6B7280]">{user.email}</p>
              <span className="mt-3 inline-flex items-center rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#1E3A8A]">
                {user.role}
              </span>
            </div>

            <div className="mt-6 space-y-3 text-sm text-[#374151]">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-[#6B7280]" />
                <span>Joined {formatJoinedDate(user.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#6B7280]" />
                <span>{user.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#6B7280]" />
                <span>Role: {user.role}</span>
              </div>
              {typeof user.rating === "number" && (
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span>{user.rating.toFixed(1)} rating</span>
                </div>
              )}
            </div>
          </section>

          <section className="lg:col-span-2 bg-white border border-[#E5E7EB] rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-[#111827] mb-4">Edit Profile</h2>

            {message && (
              <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {message}
              </div>
            )}

            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <UserCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF]"
                    placeholder="Your full name"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1.5">
                  Avatar URL
                </label>
                <input
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF]"
                  placeholder="https://..."
                />
              </div>

              <div className="pt-1">
                <PrimaryButton type="submit" disabled={!hasChanges || submitting}>
                  {submitting ? "Saving..." : "Save Changes"}
                </PrimaryButton>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
