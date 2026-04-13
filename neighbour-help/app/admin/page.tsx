"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Briefcase,
  ShieldCheck,
  Zap,
  ShieldAlert,
  ArrowRight,
  Ban,
  Gavel,
} from "lucide-react";
import { useRequireRole } from "@/app/lib/hooks/useRequireRole";
import {
  adminService,
  type AdminUserItem,
  type BidTransactionItem,
} from "@/app/lib/api/admin";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export default function AdminPage() {
  const { authorized, loading } = useRequireRole("admin");
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [transactions, setTransactions] = useState<BidTransactionItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authorized) return;

    let cancelled = false;

    const load = async () => {
      setFetching(true);
      setError(null);
      try {
        const [usersData, bidData] = await Promise.all([
          adminService.getUsers(),
          adminService.getBidTransactions(),
        ]);
        if (!cancelled) {
          setUsers(usersData);
          setTransactions(bidData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
        }
      } finally {
        if (!cancelled) setFetching(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [authorized]);

  const startOfToday = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }, []);

  const pendingHandymen = useMemo(() => {
    return users
      .filter((u) => u.role === "handyman" && u.verificationStatus === "pending")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [users]);

  const flaggedBids = useMemo(() => {
    return transactions
      .filter((t) => t.flagged)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [transactions]);

  const emergencyJobs = useMemo(() => {
    const byJob = new Map<string, { id: string; title: string; postedAt: string; bidCount: number }>();

    for (const row of transactions) {
      if (!row.emergency) continue;
      const key = row.jobTitle;
      const existing = byJob.get(key);
      if (!existing) {
        byJob.set(key, {
          id: row.id,
          title: row.jobTitle,
          postedAt: row.createdAt,
          bidCount: 1,
        });
      } else {
        existing.bidCount += 1;
        if (new Date(row.createdAt).getTime() < new Date(existing.postedAt).getTime()) {
          existing.postedAt = row.createdAt;
        }
      }
    }

    return Array.from(byJob.values())
      .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime())
      .slice(0, 5);
  }, [transactions]);

  const metrics = useMemo(() => {
    const newUsersToday = users.filter((u) => new Date(u.createdAt).getTime() >= startOfToday).length;
    const bidsToday = transactions.filter((t) => new Date(t.createdAt).getTime() >= startOfToday).length;
    const blockedAccounts = users.filter((u) => u.status === "blocked").length;
    const pendingVerificationCount = users.filter(
      (u) => u.role === "handyman" && u.verificationStatus === "pending"
    ).length;

    return [
      {
        label: "New Users Today",
        value: String(newUsersToday),
        delta: `${users.length} total`,
        icon: Users,
        color: "text-blue-600",
        bg: "bg-blue-50",
      },
      {
        label: "Pending Verifications",
        value: String(pendingVerificationCount),
        delta: "handyman",
        icon: Briefcase,
        color: "text-amber-600",
        bg: "bg-amber-50",
      },
      {
        label: "Bids Created Today",
        value: String(bidsToday),
        delta: `${transactions.length} total`,
        icon: Gavel,
        color: "text-purple-600",
        bg: "bg-purple-50",
      },
      {
        label: "Blocked Accounts",
        value: String(blockedAccounts),
        delta: "active moderation",
        icon: Ban,
        color: "text-red-600",
        bg: "bg-red-50",
      },
    ];
  }, [startOfToday, transactions, users]);

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
              href="/admin/reports"
              className="px-4 py-2 rounded-lg bg-white border border-[#E5E7EB] text-sm font-semibold text-[#111827] hover:bg-[#F7F8FA]"
            >
              Reports
            </Link>
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

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {metrics.map((metric) => {
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
              {pendingHandymen.map((h) => (
                <div key={h.id} className="rounded-xl border border-[#E5E7EB] p-3">
                  <p className="text-sm font-semibold text-[#111827]">{h.name}</p>
                  <p className="text-xs text-[#6B7280]">{h.email}</p>
                  <p className="text-xs text-[#9CA3AF] mt-1">Joined {timeAgo(h.createdAt)}</p>
                </div>
              ))}
              {!fetching && pendingHandymen.length === 0 && (
                <p className="text-sm text-[#6B7280]">No pending verifications.</p>
              )}
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
              {flaggedBids.map((bid) => (
                <div key={bid.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-semibold text-[#111827]">{bid.jobTitle}</p>
                  <p className="text-xs text-[#6B7280]">Bid by {bid.handymanName}</p>
                  <p className="text-xs text-amber-700 mt-1">Flagged transaction requires review.</p>
                  <p className="text-xs text-[#9CA3AF] mt-1">{timeAgo(bid.createdAt)}</p>
                </div>
              ))}
              {!fetching && flaggedBids.length === 0 && (
                <p className="text-sm text-[#6B7280]">No flagged bids right now.</p>
              )}
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
              {emergencyJobs.map((job) => (
                <div key={job.id} className="rounded-xl border border-[#E5E7EB] p-3">
                  <p className="text-sm font-semibold text-[#111827]">{job.title}</p>
                  <p className="text-xs mt-1 text-red-600 font-medium">
                    {job.bidCount === 0 ? "No bids yet" : `${job.bidCount} bid(s)`}
                  </p>
                  <p className="text-xs text-[#9CA3AF] mt-1">Posted {timeAgo(job.postedAt)}</p>
                </div>
              ))}
              {!fetching && emergencyJobs.length === 0 && (
                <p className="text-sm text-[#6B7280]">No emergency jobs in queue.</p>
              )}
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
