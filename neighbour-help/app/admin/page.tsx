"use client";

import Link from "next/link";
import {
  Users,
  Briefcase,
  Clock,
  ShieldCheck,
  Zap,
  ShieldAlert,
  ArrowRight,
  Ban,
  Gavel,
} from "lucide-react";
import { useRequireRole } from "@/app/lib/hooks/useRequireRole";

const METRICS = [
  {
    label: "New Users Today",
    value: "42",
    delta: "+9%",
    icon: Users,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    label: "Jobs Posted Today",
    value: "67",
    delta: "+14",
    icon: Briefcase,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    label: "Bids Created Today",
    value: "219",
    delta: "+27",
    icon: Gavel,
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
  {
    label: "Blocked Accounts",
    value: "8",
    delta: "2 today",
    icon: Ban,
    color: "text-red-600",
    bg: "bg-red-50",
  },
];

const PENDING_HANDYMEN = [
  {
    id: "v1",
    name: "Ahmad Faris",
    category: "Plumbing",
    experience: "5 years",
    submittedAt: "2026-03-26T08:00:00Z",
  },
  {
    id: "v2",
    name: "Raj Kumar",
    category: "Electrical",
    experience: "8 years",
    submittedAt: "2026-03-26T11:30:00Z",
  },
];

const FLAGGED_BIDS = [
  {
    id: "b101",
    jobTitle: "Water heater not working",
    handyman: "Demo Handyman",
    reason: "Price spike >300% vs median",
    createdAt: "2026-03-26T10:10:00Z",
  },
  {
    id: "b109",
    jobTitle: "Emergency electrical short",
    handyman: "Raj Kumar",
    reason: "Repeated bid edits in 5 min",
    createdAt: "2026-03-26T11:05:00Z",
  },
];

const EMERGENCY_JOBS = [
  {
    id: "e1",
    title: "Gas leak suspected",
    location: "Cheras, Kuala Lumpur",
    postedAt: "2026-03-26T06:45:00Z",
    bidCount: 0,
  },
  {
    id: "e2",
    title: "Water heater sparking",
    location: "Bangsar, Kuala Lumpur",
    postedAt: "2026-03-26T07:10:00Z",
    bidCount: 1,
  },
];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export default function AdminPage() {
  const { authorized, loading } = useRequireRole("admin");

  if (loading || !authorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">Admin Dashboard</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              Daily operations, user moderation, and bid transaction control
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/transactions/bids"
              className="px-4 py-2 rounded-lg bg-white border border-[#E5E7EB] text-sm font-semibold text-[#111827] hover:bg-[#F7F8FA]"
            >
              Bid Transactions
            </Link>
            <Link
              href="/admin/users"
              className="px-4 py-2 rounded-lg bg-[#0B74FF] text-white text-sm font-semibold hover:bg-[#065ed1]"
            >
              Manage Users
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {METRICS.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 ${metric.bg} rounded-xl flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${metric.color}`} />
                  </div>
                  <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    {metric.delta}
                  </span>
                </div>
                <p className="text-2xl font-bold text-[#111827]">{metric.value}</p>
                <p className="text-sm text-[#6B7280] mt-0.5">{metric.label}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-4 h-4 text-[#0B74FF]" />
              <h2 className="text-sm font-semibold text-[#111827]">Pending Handyman Verification</h2>
            </div>
            <div className="space-y-3">
              {PENDING_HANDYMEN.map((h) => (
                <div key={h.id} className="rounded-xl border border-[#E5E7EB] p-3">
                  <p className="text-sm font-semibold text-[#111827]">{h.name}</p>
                  <p className="text-xs text-[#6B7280]">{h.category} · {h.experience}</p>
                  <p className="text-xs text-[#9CA3AF] mt-1">Submitted {timeAgo(h.submittedAt)}</p>
                </div>
              ))}
            </div>
            <Link href="/admin/users" className="mt-4 inline-flex items-center text-sm font-semibold text-[#0B74FF] hover:underline">
              Review all verifications <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <h2 className="text-sm font-semibold text-[#111827]">Flagged Bid Activity</h2>
            </div>
            <div className="space-y-3">
              {FLAGGED_BIDS.map((bid) => (
                <div key={bid.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-semibold text-[#111827]">{bid.jobTitle}</p>
                  <p className="text-xs text-[#6B7280]">Bid by {bid.handyman}</p>
                  <p className="text-xs text-amber-700 mt-1">{bid.reason}</p>
                  <p className="text-xs text-[#9CA3AF] mt-1">{timeAgo(bid.createdAt)}</p>
                </div>
              ))}
            </div>
            <Link href="/admin/transactions/bids" className="mt-4 inline-flex items-center text-sm font-semibold text-[#0B74FF] hover:underline">
              Open bid transaction queue <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-red-500" />
              <h2 className="text-sm font-semibold text-[#111827]">Emergency Jobs Queue</h2>
            </div>
            <div className="space-y-3">
              {EMERGENCY_JOBS.map((job) => (
                <div key={job.id} className="rounded-xl border border-[#E5E7EB] p-3">
                  <p className="text-sm font-semibold text-[#111827]">{job.title}</p>
                  <p className="text-xs text-[#6B7280]">{job.location}</p>
                  <p className="text-xs mt-1 text-red-600 font-medium">
                    {job.bidCount === 0 ? "No bids yet" : `${job.bidCount} bid(s)`}
                  </p>
                  <p className="text-xs text-[#9CA3AF] mt-1">Posted {timeAgo(job.postedAt)}</p>
                </div>
              ))}
            </div>
            <Link href="/admin/transactions/bids" className="mt-4 inline-flex items-center text-sm font-semibold text-[#0B74FF] hover:underline">
              Check emergency bid activity <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
