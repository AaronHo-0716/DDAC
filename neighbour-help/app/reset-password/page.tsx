"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import PrimaryButton from "../components/ui/PrimaryButton";
import { authService } from "../lib/api/auth";
import { ApiClientError } from "../lib/api/client";

const MIN_PASSWORD_LENGTH = 8;

type Step = "form" | "success";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";

  const [step, setStep] = useState<Step>("form");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const passwordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const hasToken = token.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!hasToken) {
      setError("Reset token is missing. Please request a new reset link.");
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (passwordMismatch) {
      setError("New password and confirmation do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await authService.resetPassword({ token, newPassword });
      setStep("success");
      setMessage("Password reset successful. You can now log in with your new password.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message || "Unable to reset password.");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Unable to reset password right now. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-8">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm text-[#6B7280] hover:text-[#111827] mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to login
        </Link>

        <h1 className="text-2xl font-bold text-[#111827] mb-1">Reset password</h1>
        <p className="text-sm text-[#6B7280] mb-6">
          Choose a new password for your account.
        </p>

        {email && (
          <div className="mb-4 text-xs text-[#6B7280] bg-[#F7F8FA] border border-[#E5E7EB] rounded-xl p-3">
            Resetting password for <span className="font-semibold text-[#111827]">{email}</span>
          </div>
        )}

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-sm text-green-700">
            {message}
          </div>
        )}

        {step === "form" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#111827] mb-1.5">New password</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full pl-10 pr-4 py-2.5 border border-[#E5E7EB] rounded-xl text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0B74FF]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#111827] mb-1.5">Confirm password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full px-4 py-2.5 border border-[#E5E7EB] rounded-xl text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0B74FF]"
              />
            </div>

            {passwordMismatch && (
              <p className="text-xs text-red-600">Password confirmation does not match.</p>
            )}

            <PrimaryButton
              type="submit"
              fullWidth
              size="lg"
              disabled={submitting || !hasToken || newPassword.length < MIN_PASSWORD_LENGTH || passwordMismatch}
            >
              {submitting ? "Resetting..." : "Reset password"}
            </PrimaryButton>
          </form>
        )}

        {step === "success" && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 flex items-start gap-2">
              <ShieldCheck className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <p>Password reset complete. You can now sign in.</p>
            </div>

            <Link href="/login" className="block">
              <PrimaryButton fullWidth size="lg">Return to login</PrimaryButton>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
