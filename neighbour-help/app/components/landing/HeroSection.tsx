"use client";

import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import PrimaryButton from "../ui/PrimaryButton";
import { useAuth } from "@/app/lib/context/AuthContext";

export default function HeroSection() {
  const { user } = useAuth();
  const browseHref = user ? "/browse" : "/login?next=%2Fbrowse";

  return (
    <section className="bg-white dark:bg-[#0B1220] pt-20 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden relative">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/60 via-white to-white dark:from-[#0F172A] dark:via-[#0B1220] dark:to-[#0B1220] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          {/* Text content */}
          <div className="flex-1 text-center lg:text-left">
            {/* Trust badge */}
            <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-[#0F1D39] border border-blue-100 dark:border-[#1E3A8A]/40 text-[#0B74FF] dark:text-[#93C5FD] text-sm font-medium px-3 py-1.5 rounded-full mb-6">
              <Star className="w-3.5 h-3.5 fill-current" />
              <span>Trusted by 10,000+ homeowners</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#111827] dark:text-[#F8FAFC] leading-tight tracking-tight mb-6">
              Smart maintenance{" "}
              <span className="text-[#0B74FF] dark:text-[#93C5FD]">for every home</span>
            </h1>

            <p className="text-lg text-[#6B7280] dark:text-[#CBD5E1] leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0">
              Post your repair job, receive competitive bids from verified local
              handymen, and get the work done right — all in one place.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Link href="/create-job">
                <PrimaryButton size="lg" variant="primary">
                  Post a Job
                  <ArrowRight className="w-4 h-4" />
                </PrimaryButton>
              </Link>
              <Link href={browseHref}>
                <PrimaryButton size="lg" variant="secondary">
                  Browse Jobs
                </PrimaryButton>
              </Link>
            </div>

            {/* Social proof */}
            <div className="mt-10 flex items-center gap-6 justify-center lg:justify-start flex-wrap">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {["#F87171", "#60A5FA", "#34D399", "#FBBF24"].map((c, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: c }}
                    >
                      {String.fromCharCode(65 + i)}
                    </div>
                  ))}
                </div>
                <span className="text-sm text-[#6B7280] dark:text-[#CBD5E1]">500+ handymen ready</span>
              </div>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
                <span className="text-sm text-[#6B7280] dark:text-[#CBD5E1] ml-1">4.9/5 rating</span>
              </div>
            </div>
          </div>

          {/* Hero visual */}
          <div className="flex-1 w-full max-w-md lg:max-w-none">
            <div className="relative">
              {/* Main card */}
              <div className="bg-white dark:bg-[#0F172A] rounded-2xl shadow-xl border border-[#E5E7EB] dark:border-[#334155] p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-[#1E293B] rounded-xl flex items-center justify-center text-2xl">
                    🔧
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-[#111827] dark:text-[#F8FAFC]">Leaky kitchen faucet</p>
                    <p className="text-sm text-[#6B7280] dark:text-[#CBD5E1]">Plumbing · Posted 2h ago</p>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 dark:bg-[#1E293B] text-green-700 dark:text-[#86EFAC] border border-green-200 dark:border-[#334155]">
                    Open
                  </span>
                </div>
                <p className="text-sm text-[#6B7280] dark:text-[#CBD5E1] mb-4">
                  My kitchen faucet has been dripping for a week. Looking for a fast fix…
                </p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#6B7280] dark:text-[#CBD5E1]">💰 Budget: RM 80 – RM 150</span>
                  <span className="text-[#0B74FF] dark:text-[#93C5FD] font-medium">4 bids received</span>
                </div>
              </div>

              {/* Floating bid card */}
              <div className="absolute -bottom-6 -right-4 bg-white dark:bg-[#0F172A] rounded-xl shadow-lg border border-[#E5E7EB] dark:border-[#334155] p-4 w-52">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-full bg-[#0B74FF] text-white text-xs font-bold flex items-center justify-center">
                    M
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#111827] dark:text-[#F8FAFC]">Mike R.</p>
                    <div className="flex items-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-sm font-bold text-[#111827] dark:text-[#F8FAFC]">RM 95</p>
                <p className="text-xs text-[#6B7280] dark:text-[#CBD5E1]">Available tomorrow</p>
              </div>

              {/* Floating accepted badge */}
              <div className="absolute -top-4 -left-4 bg-[#0B74FF] text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-md">
                ✓ Bid Accepted
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
