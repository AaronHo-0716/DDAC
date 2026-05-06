"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Wrench, ArrowRight, Mail, Lock, ShieldCheck, RefreshCw } from "lucide-react";
import PrimaryButton from "../components/ui/PrimaryButton";
import { useAuth } from "../lib/context/AuthContext";
import { ApiClientError } from "../lib/api/client";
import { authService } from "../lib/api/auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, submitting, verifyEmailOtp } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpInfo, setOtpInfo] = useState<string | null>(null);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOtpInfo(null);
    try {
      const user = await login({ email, password });
      const next = searchParams.get("next");
      if (next && next.startsWith("/")) {
        router.push(next);
        return;
      }

      if (user.role === "handyman") {
        router.push("/handyman");
      } else if (user.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        const needsVerification = /email not verified|account is not verified|verification code/i.test(
          err.message
        );
        setOtpStep(needsVerification);
        if (needsVerification) {
          await handleSendOtp();
        }
      } else if (err instanceof Error) {
        setError(err.message);
        setOtpStep(false);
      } else {
        setError("Something went wrong. Please try again.");
        setOtpStep(false);
      }
    }
  };

  const handleSendOtp = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Enter your email address to receive a verification code.");
      return;
    }

    setResendingOtp(true);
    setError(null);
    setOtpInfo(null);

    try {
      const response = await authService.sendOtp(normalizedEmail);
      setOtpInfo(response.message ?? "Verification code sent to your email.");
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Unable to send the verification code. Please try again.");
      }
    } finally {
      setResendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Enter your email address to verify your account.");
      return;
    }

    const normalizedOtp = otp.trim();
    if (normalizedOtp.length !== 6) {
      setError("Enter the 6-digit verification code sent to your email.");
      return;
    }

    setVerifyingOtp(true);
    setError(null);
    setOtpInfo(null);

    try {
      const user = await verifyEmailOtp({ email: normalizedEmail, otp: normalizedOtp });
      const next = searchParams.get("next");
      if (next && next.startsWith("/")) {
        router.push(next);
        return;
      }

      if (user.role === "handyman") {
        router.push("/handyman");
      } else if (user.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Unable to verify the code. Please try again.");
      }
    } finally {
      setVerifyingOtp(false);
    }
  };

  const canVerifyOtp = otp.trim().length === 6;

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col items-center justify-center px-4 py-12">
      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-8">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 bg-[#0B74FF] rounded-xl flex items-center justify-center">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-[#111827]">
            Neighbour<span className="text-[#0B74FF]">Help</span>
          </span>
        </div>

        <h1 className="text-2xl font-bold text-[#111827] text-center mb-1">
          Welcome back
        </h1>
        <p className="text-[#6B7280] text-sm text-center mb-8">
          Sign in to manage your jobs and bids
        </p>

        {/* Error banner */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-[#111827] mb-1.5">
              Email address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0B74FF] focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-[#111827]">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-[#0B74FF] hover:underline font-medium"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full pl-10 pr-10 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0B74FF] focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111827] transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <div className="flex items-center gap-2">
            <input
              id="remember"
              type="checkbox"
              className="w-4 h-4 rounded border-[#E5E7EB] text-[#0B74FF] focus:ring-[#0B74FF] cursor-pointer"
            />
            <label htmlFor="remember" className="text-sm text-[#6B7280] cursor-pointer">
              Remember me for 30 days
            </label>
          </div>

          <PrimaryButton
            type="submit"
            fullWidth
            size="lg"
            disabled={submitting}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Signing in…
              </span>
            ) : (
              <>
                Sign In
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </PrimaryButton>
        </form>

        {otpStep && (
          <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <ShieldCheck className="w-4 h-4 text-[#0B74FF]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#111827]">Verify your email</p>
                <p className="text-xs text-[#6B7280] mt-1">
                  We can resend a verification code to finish your sign in.
                </p>
              </div>
            </div>

            {otpInfo && (
              <div className="mt-3 rounded-xl bg-white border border-[#E5E7EB] px-3 py-2 text-xs text-[#374151]">
                {otpInfo}
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#111827] mb-1">Verification code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-digit code"
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-xl text-sm tracking-[0.3em] text-center focus:outline-none focus:ring-2 focus:ring-[#0B74FF]"
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={resendingOtp}
                  className="inline-flex items-center gap-2 text-[#0B74FF] font-semibold hover:underline disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {resendingOtp ? "Sending..." : otpInfo ? "Resend code" : "Send code"}
                </button>
                <span className="text-[#6B7280]">Code expires in 15 minutes.</span>
              </div>

              <PrimaryButton type="submit" fullWidth size="md" disabled={!canVerifyOtp || verifyingOtp}>
                {verifyingOtp ? (
                  "Verifying..."
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" /> Verify & Continue
                  </>
                )}
              </PrimaryButton>
            </form>
          </div>
        )}

        {/* Sign up link */}
        <p className="text-center text-sm text-[#6B7280] mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-[#0B74FF] font-semibold hover:underline">
            Create one free
          </Link>
        </p>
      </div>

      {/* Role selector hint */}
      <p className="mt-4 text-xs text-[#9CA3AF] text-center">
        Looking to offer your services?{" "}
        <Link href="/register?role=handyman" className="text-[#0B74FF] hover:underline">
          Join as a Handyman
        </Link>
      </p>

    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
