"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UserPlus, Wrench, Home, ArrowRight, Eye, EyeOff } from "lucide-react";
import PrimaryButton from "../components/ui/PrimaryButton";
import NotificationToast from "../components/ui/NotificationToast";
import HandymanVerificationForms from "../components/ui/HandymanVerificationForms";
import { ApiClientError } from "../lib/api/client";
import { useAuth } from "../lib/context/AuthContext";
import type { UserRole } from "../types";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register, submitting } = useAuth();

  const initialRole = useMemo<UserRole>(() => {
    const role = searchParams.get("role");
    if (role === "handyman") return "handyman";
    return "homeowner";
  }, [searchParams]);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<UserRole>(initialRole);
  const [hasVerificationDocs, setHasVerificationDocs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const canSubmit =
    name.trim() !== "" &&
    email.trim() !== "" &&
    password.length >= 8 &&
    confirmPassword.length >= 8 &&
    !passwordMismatch &&
    (role !== "handyman" || hasVerificationDocs);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    if (role === "handyman" && !hasVerificationDocs) {
      setError("Please select both selfie and identification card images before registering as a handyman.");
      return;
    }

    setError(null);

    try {
      await register({ name, email, password, role });
      router.push(role === "handyman" ? "/handyman" : "/dashboard");
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Unable to create account. Please try again.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg bg-white border border-[#E5E7EB] rounded-2xl shadow-sm p-8">
        <div className="flex items-center justify-center gap-2 mb-7">
          <div className="w-9 h-9 bg-[#0B74FF] rounded-xl flex items-center justify-center">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-[#111827]">
            Neighbour<span className="text-[#0B74FF]">Help</span>
          </span>
        </div>

        <h1 className="text-2xl font-bold text-[#111827] text-center mb-1">Create your account</h1>
        <p className="text-sm text-[#6B7280] text-center mb-6">
          Start posting jobs or offer handyman services in your area.
        </p>

        {error && (
          <div className="mb-4">
            <NotificationToast
              variant="error"
              title="Registration failed"
              message={error}
              onClose={() => setError(null)}
            />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#111827] mb-1.5">Full Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aisyah Rahman"
              className="w-full px-4 py-2.5 border border-[#E5E7EB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#111827] mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 border border-[#E5E7EB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#111827] mb-1.5">Role</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("homeowner")}
                className={`px-4 py-2.5 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  role === "homeowner"
                    ? "bg-blue-50 border-[#0B74FF] text-[#0B74FF]"
                    : "bg-white border-[#E5E7EB] text-[#374151] hover:bg-[#F7F8FA]"
                }`}
              >
                <Home className="w-4 h-4" /> Homeowner
              </button>
              <button
                type="button"
                onClick={() => setRole("handyman")}
                className={`px-4 py-2.5 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  role === "handyman"
                    ? "bg-blue-50 border-[#0B74FF] text-[#0B74FF]"
                    : "bg-white border-[#E5E7EB] text-[#374151] hover:bg-[#F7F8FA]"
                }`}
              >
                <Wrench className="w-4 h-4" /> Handyman
              </button>
            </div>
          </div>

          {role === "handyman" && (
            <div>
              <HandymanVerificationForms
                mode="signup"
                onFilesChange={setHasVerificationDocs}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#111827] mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full px-4 py-2.5 pr-11 border border-[#E5E7EB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#111827] mb-1.5">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                className={`w-full px-4 py-2.5 pr-11 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF] ${
                  passwordMismatch ? "border-red-300" : "border-[#E5E7EB]"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280]"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {passwordMismatch && (
              <p className="text-xs text-red-600 mt-1">Passwords do not match.</p>
            )}
          </div>

          <PrimaryButton type="submit" size="lg" fullWidth disabled={!canSubmit || submitting}>
            {submitting ? (
              "Creating account..."
            ) : (
              <>
                <UserPlus className="w-4 h-4" /> Create Account <ArrowRight className="w-4 h-4" />
              </>
            )}
          </PrimaryButton>
        </form>

        <p className="text-sm text-[#6B7280] text-center mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-[#0B74FF] font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
