"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Mail, ShieldCheck, KeyRound, RefreshCcw } from "lucide-react";
import PrimaryButton from "../components/ui/PrimaryButton";
import { authService } from "../lib/api/auth";
import { ApiClientError } from "../lib/api/client";

type Step = "request" | "verify" | "success";

const OTP_LENGTH = 6;

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((v) => (v > 0 ? v - 1 : 0));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [cooldown]);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const sanitizedOtp = useMemo(() => otp.replace(/\D/g, "").slice(0, OTP_LENGTH), [otp]);

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);

    try {
      const response = await authService.requestPasswordResetOtp({
        email: normalizedEmail,
      });
      setStep("verify");
      setCooldown(response.cooldownSeconds ?? 30);
      setMessage(response.message || "An OTP has been sent to your email inbox.");
    } catch (err) {
      if (err instanceof ApiClientError && err.statusCode === 404) {
        setError(
          "Password reset OTP endpoint is not available yet on the backend. Please implement /api/auth/password/otp/request first."
        );
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Unable to send OTP right now. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (sanitizedOtp.length !== OTP_LENGTH) {
      setError("Please enter the 6-digit OTP sent to your email.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await authService.verifyPasswordResetOtp({
        email: normalizedEmail,
        otp: sanitizedOtp,
      });

      if (!response.verified) {
        setError(response.message || "OTP verification failed. Please try again.");
        return;
      }

      setStep("success");
      setMessage(response.message || "Email verified successfully.");
    } catch (err) {
      if (err instanceof ApiClientError && err.statusCode === 404) {
        setError(
          "Password reset OTP verification endpoint is not available yet on the backend. Please implement /api/auth/password/otp/verify first."
        );
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Unable to verify OTP right now. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resendOtp = async () => {
    if (cooldown > 0 || submitting) return;
    setError(null);
    setMessage(null);
    setSubmitting(true);

    try {
      const response = await authService.requestPasswordResetOtp({
        email: normalizedEmail,
      });
      setCooldown(response.cooldownSeconds ?? 30);
      setMessage(response.message || "A new OTP has been sent.");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Unable to resend OTP right now. Please try again.");
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

        <h1 className="text-2xl font-bold text-[#111827] mb-1">Forgot password</h1>
        <p className="text-sm text-[#6B7280] mb-6">
          Verify your email with a one-time code so we can safely continue the reset process.
        </p>

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

        {step === "request" && (
          <form onSubmit={submitEmail} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#111827] mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 border border-[#E5E7EB] rounded-xl text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0B74FF]"
                />
              </div>
            </div>

            <PrimaryButton type="submit" fullWidth size="lg" disabled={submitting || !normalizedEmail}>
              {submitting ? "Sending OTP..." : "Send verification code"}
            </PrimaryButton>
          </form>
        )}

        {step === "verify" && (
          <form onSubmit={verifyOtp} className="space-y-4">
            <div className="text-xs text-[#6B7280] bg-[#F7F8FA] border border-[#E5E7EB] rounded-xl p-3">
              OTP sent to <span className="font-semibold text-[#111827]">{normalizedEmail}</span>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#111827] mb-1.5">One-time password</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  value={sanitizedOtp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="w-full pl-10 pr-4 py-2.5 border border-[#E5E7EB] rounded-xl text-sm tracking-[0.25em] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0B74FF]"
                />
              </div>
            </div>

            <PrimaryButton
              type="submit"
              fullWidth
              size="lg"
              disabled={submitting || sanitizedOtp.length !== OTP_LENGTH}
            >
              {submitting ? "Verifying..." : "Verify email"}
            </PrimaryButton>

            <button
              type="button"
              onClick={resendOtp}
              disabled={cooldown > 0 || submitting}
              className="w-full inline-flex items-center justify-center gap-2 text-sm text-[#0B74FF] disabled:text-[#9CA3AF] hover:underline disabled:no-underline"
            >
              <RefreshCcw className="w-4 h-4" />
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
          </form>
        )}

        {step === "success" && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 flex items-start gap-2">
              <ShieldCheck className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <p>
                Your email is verified. You can now continue with password reset in the next step of
                your backend flow.
              </p>
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
