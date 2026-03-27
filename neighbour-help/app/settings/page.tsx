"use client";

import { useEffect, useState } from "react";
import { Bell, Lock, ShieldCheck, UserCog } from "lucide-react";
import PrimaryButton from "@/app/components/ui/PrimaryButton";
import { authService } from "@/app/lib/api/auth";
import { useRequireRole } from "@/app/lib/hooks/useRequireRole";
import type { JobCategory, UserSettings } from "@/app/types";

const allCategories: JobCategory[] = [
  "Plumbing",
  "Electrical",
  "Carpentry",
  "Appliance Repair",
  "General Maintenance",
];

const emptySettings: UserSettings = {
  notifications: {
    emailBidUpdates: true,
    emailJobUpdates: true,
    productAnnouncements: false,
  },
  privacy: {
    showProfileToPublic: false,
    sharePreciseLocation: false,
  },
};

export default function SettingsPage() {
  const { authorized, loading, user } = useRequireRole([
    "homeowner",
    "handyman",
    "admin",
  ]);

  const [settings, setSettings] = useState<UserSettings>(emptySettings);
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!authorized || !user) return;

    let ignore = false;
    setBusy(true);
    setError(null);

    authService
      .getSettings()
      .then((result) => {
        if (!ignore) setSettings(result);
      })
      .catch((err) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Unable to load settings.");
        }
      })
      .finally(() => {
        if (!ignore) setBusy(false);
      });

    return () => {
      ignore = true;
    };
  }, [authorized, user]);

  if (loading || !authorized || !user) {
    return null;
  }

  const passwordMismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;

  const roleTitle =
    user.role === "handyman"
      ? "Handyman Preferences"
      : user.role === "homeowner"
      ? "Homeowner Preferences"
      : "Account Preferences";

  const homeownerFallback = {
    defaultEmergency: false,
    preferredContactMethod: "email" as const,
  };

  const handymanFallback = {
    serviceRadiusKm: 10,
    acceptingNewJobs: true,
    categories: ["General Maintenance"] as JobCategory[],
  };

  const saveSettings = async () => {
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const updated = await authService.updateSettings(settings);
      setSettings(updated);
      setMessage("Settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save settings.");
    } finally {
      setSubmitting(false);
    }
  };

  const updatePassword = async () => {
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (passwordMismatch) {
      setError("New password and confirmation do not match.");
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      await authService.changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password changed successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to change password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Settings</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Manage notifications, privacy, and security preferences.
          </p>
        </div>

        {message && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="bg-white border border-[#E5E7EB] rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[#111827] mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#0B74FF]" /> Notifications
          </h2>

          {busy ? (
            <p className="text-sm text-[#6B7280]">Loading settings...</p>
          ) : (
            <div className="space-y-3">
              <label className="flex items-center justify-between text-sm text-[#111827]">
                <span>Email updates for bids</span>
                <input
                  type="checkbox"
                  checked={settings.notifications.emailBidUpdates}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      notifications: {
                        ...prev.notifications,
                        emailBidUpdates: e.target.checked,
                      },
                    }))
                  }
                />
              </label>

              <label className="flex items-center justify-between text-sm text-[#111827]">
                <span>Email updates for jobs</span>
                <input
                  type="checkbox"
                  checked={settings.notifications.emailJobUpdates}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      notifications: {
                        ...prev.notifications,
                        emailJobUpdates: e.target.checked,
                      },
                    }))
                  }
                />
              </label>

              <label className="flex items-center justify-between text-sm text-[#111827]">
                <span>Product announcements</span>
                <input
                  type="checkbox"
                  checked={settings.notifications.productAnnouncements}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      notifications: {
                        ...prev.notifications,
                        productAnnouncements: e.target.checked,
                      },
                    }))
                  }
                />
              </label>
            </div>
          )}
        </section>

        <section className="bg-white border border-[#E5E7EB] rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[#111827] mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#0B74FF]" /> Privacy
          </h2>

          <div className="space-y-3">
            <label className="flex items-center justify-between text-sm text-[#111827]">
              <span>Show profile publicly</span>
              <input
                type="checkbox"
                checked={settings.privacy.showProfileToPublic}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    privacy: {
                      ...prev.privacy,
                      showProfileToPublic: e.target.checked,
                    },
                  }))
                }
              />
            </label>

            <label className="flex items-center justify-between text-sm text-[#111827]">
              <span>Share precise location</span>
              <input
                type="checkbox"
                checked={settings.privacy.sharePreciseLocation}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    privacy: {
                      ...prev.privacy,
                      sharePreciseLocation: e.target.checked,
                    },
                  }))
                }
              />
            </label>
          </div>
        </section>

        <section className="bg-white border border-[#E5E7EB] rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[#111827] mb-4 flex items-center gap-2">
            <UserCog className="w-5 h-5 text-[#0B74FF]" /> {roleTitle}
          </h2>

          {user.role === "homeowner" && settings.homeowner && (
            <div className="space-y-4">
              <label className="flex items-center justify-between text-sm text-[#111827]">
                <span>Default new jobs to emergency</span>
                <input
                  type="checkbox"
                  checked={settings.homeowner.defaultEmergency}
                  onChange={(e) =>
                    setSettings((prev) => {
                      const homeowner = prev.homeowner ?? homeownerFallback;
                      return {
                        ...prev,
                        homeowner: {
                          ...homeowner,
                          defaultEmergency: e.target.checked,
                        },
                      };
                    })
                  }
                />
              </label>

              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1.5">
                  Preferred contact method
                </label>
                <select
                  value={settings.homeowner.preferredContactMethod}
                  onChange={(e) =>
                    setSettings((prev) => {
                      const homeowner = prev.homeowner ?? homeownerFallback;
                      return {
                        ...prev,
                        homeowner: {
                          ...homeowner,
                          preferredContactMethod: e.target.value as "email" | "phone",
                        },
                      };
                    })
                  }
                  className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF]"
                >
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                </select>
              </div>
            </div>
          )}

          {user.role === "handyman" && settings.handyman && (
            <div className="space-y-4">
              <label className="flex items-center justify-between text-sm text-[#111827]">
                <span>Accepting new jobs</span>
                <input
                  type="checkbox"
                  checked={settings.handyman.acceptingNewJobs}
                  onChange={(e) =>
                    setSettings((prev) => {
                      const handyman = prev.handyman ?? handymanFallback;
                      return {
                        ...prev,
                        handyman: {
                          ...handyman,
                          acceptingNewJobs: e.target.checked,
                        },
                      };
                    })
                  }
                />
              </label>

              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1.5">
                  Service radius (km)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={settings.handyman.serviceRadiusKm}
                  onChange={(e) =>
                    setSettings((prev) => {
                      const handyman = prev.handyman ?? handymanFallback;
                      return {
                        ...prev,
                        handyman: {
                          ...handyman,
                          serviceRadiusKm: Number(e.target.value) || 1,
                        },
                      };
                    })
                  }
                  className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1.5">
                  Preferred categories
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {allCategories.map((category) => {
                    const selected = settings.handyman?.categories.includes(category) ?? false;

                    return (
                      <label
                        key={category}
                        className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#111827]"
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(e) => {
                            setSettings((prev) => {
                              const handyman = prev.handyman ?? handymanFallback;
                              const current = handyman.categories;
                              const next = e.target.checked
                                ? [...current, category]
                                : current.filter((item) => item !== category);

                              return {
                                ...prev,
                                handyman: {
                                  ...handyman,
                                  categories: Array.from(new Set(next)),
                                },
                              };
                            });
                          }}
                        />
                        <span>{category}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {user.role === "admin" && (
            <p className="text-sm text-[#6B7280]">
              Admin operational controls stay in the admin area. Personal settings on this page
              apply only to your account.
            </p>
          )}
        </section>

        <section className="bg-white border border-[#E5E7EB] rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[#111827] mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#0B74FF]" /> Security
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF]"
              placeholder="Current password"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF]"
              placeholder="New password"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF]"
              placeholder="Confirm new password"
            />
          </div>

          {passwordMismatch && (
            <p className="text-xs text-red-600 mt-2">Password confirmation does not match.</p>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <PrimaryButton onClick={saveSettings} disabled={busy || submitting}>
              {submitting ? "Saving..." : "Save Settings"}
            </PrimaryButton>
            <PrimaryButton
              variant="secondary"
              onClick={updatePassword}
              disabled={
                submitting ||
                currentPassword.length === 0 ||
                newPassword.length === 0 ||
                confirmPassword.length === 0 ||
                passwordMismatch
              }
            >
              {submitting ? "Updating..." : "Change Password"}
            </PrimaryButton>
          </div>
        </section>
      </div>
    </div>
  );
}
