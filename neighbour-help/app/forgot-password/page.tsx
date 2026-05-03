"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import PrimaryButton from "../components/ui/PrimaryButton";
import { authService } from "../lib/api/auth";
import { ApiClientError } from "../lib/api/client";

type Step = "request" | "sent";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedEmail = email.trim().toLowerCase();

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await authService.forgotPassword({ email: normalizedEmail });
      setStep("sent");
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message || "Unable to send reset email.");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Unable to send reset email right now. Please try again.");
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
          We will email you a reset link to set a new password.
        </p>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
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
              {submitting ? "Sending email..." : "Send reset link"}
            </PrimaryButton>
          </form>
        )}

        {step === "sent" && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 flex items-start gap-2">
              <ShieldCheck className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <p>
                If the email exists, we have sent a secure reset link. Please check your inbox and spam
                folder.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setStep("request");
              }}
              className="w-full text-sm text-[#0B74FF] hover:underline"
            >
              Send another email
            </button>

            <Link href="/login" className="block">
              <PrimaryButton fullWidth size="lg">Return to login</PrimaryButton>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
