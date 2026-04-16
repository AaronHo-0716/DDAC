"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, Mail, Shield, Star, Upload, X } from "lucide-react";
import PrimaryButton from "@/app/components/ui/PrimaryButton";
import { useRequireRole } from "@/app/lib/hooks/useRequireRole";
import { useAuth } from "@/app/lib/context/AuthContext";
import { authService } from "@/app/lib/api/auth";

function formatJoinedDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "Unknown" : d.toLocaleDateString();
}

const MAX_IMAGE_SIZE_MB = 10;
const MAX_IMAGE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
];

function validateImageFile(file: File): string | null {
  if (file.size > MAX_IMAGE_BYTES) {
    return `Image is too large. Maximum size is ${MAX_IMAGE_SIZE_MB}MB.`;
  }

  if (!file.type || !ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
    return "Unsupported image format. Use JPG, PNG, WEBP, HEIC, or GIF.";
  }

  return null;
}

export default function ProfilePage() {
  const { authorized, loading, user } = useRequireRole([
    "homeowner",
    "handyman",
    "admin",
  ]);
  const { refreshUser } = useAuth();

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!user) return;
    setAvatarPreviewUrl(user.avatarUrl ?? "");
    setAvatarFile(null);
    setError(null);
    setMessage(null);
  }, [user]);

  if (loading || !authorized || !user) {
    return null;
  }

  const isApprovedHandyman =
    user.role === "handyman" && user.verification === "approved";

  const hasChanges = avatarFile !== null && !isApprovedHandyman;

  const handleSelectFile = (incoming: FileList | null) => {
    if (isApprovedHandyman) {
      setError(
        "Approved handyman accounts cannot change avatar images. Please contact support if a change is required."
      );
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    const selected = incoming?.[0] ?? null;

    setMessage(null);

    if (!selected) {
      setAvatarFile(null);
      return;
    }

    const validationError = validateImageFile(selected);
    if (validationError) {
      setAvatarFile(null);
      setError(validationError);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setError(null);
    setAvatarFile(selected);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isApprovedHandyman) {
      setError(
        "Approved handyman accounts cannot change avatar images. Please contact support if a change is required."
      );
      return;
    }

    if (!avatarFile) return;

    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const updatedUser = await authService.updateProfilePicture(avatarFile);
      setAvatarPreviewUrl(updatedUser.avatarUrl ?? "");
      setAvatarFile(null);
      await refreshUser();
      setMessage("Profile picture updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update profile picture.");
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
              {avatarPreviewUrl ? (
                <img
                  src={avatarPreviewUrl}
                  alt={`${user.name} avatar`}
                  className="w-20 h-20 rounded-full object-cover border border-[#E5E7EB] mb-3"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[#0B74FF] text-white flex items-center justify-center text-2xl font-bold mb-3">
                  {user.name?.charAt(0).toUpperCase() ?? "U"}
                </div>
              )}
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
            <h2 className="text-lg font-semibold text-[#111827] mb-4">Update Profile Picture</h2>

            {isApprovedHandyman && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Your handyman account is approved. Avatar changes are locked to preserve verified identity.
              </div>
            )}

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
                  Profile Picture
                </label>

                <div className="rounded-2xl border border-[#E5E7EB] p-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/gif"
                    onChange={(e) => handleSelectFile(e.target.files)}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isApprovedHandyman}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#111827] hover:bg-[#F7F8FA] transition-colors"
                  >
                    <Upload className="w-4 h-4" /> Choose Image
                  </button>

                  {avatarFile && (
                    <div className="mt-3 flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-[#111827]">{avatarFile.name}</p>
                        <p className="text-xs text-[#6B7280]">{(avatarFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarFile(null);
                          setError(null);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
                        }}
                        className="ml-3 flex h-7 w-7 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6]"
                        aria-label="Remove selected image"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <p className="mt-2 text-xs text-[#6B7280]">
                  Supported formats: JPG, PNG, WEBP, HEIC, GIF. Max {MAX_IMAGE_SIZE_MB}MB.
                </p>
              </div>

              <div className="pt-1">
                <PrimaryButton type="submit" disabled={!hasChanges || submitting || isApprovedHandyman}>
                  {submitting ? "Uploading..." : "Upload Picture"}
                </PrimaryButton>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
