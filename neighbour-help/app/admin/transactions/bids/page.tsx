"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Lock, Shield, ShieldCheck } from "lucide-react";
import { useRequireRole } from "@/app/lib/hooks/useRequireRole";
import {
  adminService,
  type AdminBidStatus,
  type BidTransactionItem,
} from "@/app/lib/api/admin";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-MY", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusPill(status: AdminBidStatus) {
  const map: Record<AdminBidStatus, string> = {
    pending: "bg-amber-50 text-amber-700 border border-amber-200",
    accepted: "bg-green-50 text-green-700 border border-green-200",
    rejected: "bg-red-50 text-red-700 border border-red-200",
    retracted: "bg-gray-100 text-gray-700 border border-gray-200",
  };

  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status]}`}>
      {status}
    </span>
  );
}

export default function AdminBidTransactionsPage() {
  const { authorized, loading } = useRequireRole("admin");
  const [rows, setRows] = useState<BidTransactionItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | AdminBidStatus>("all");
  const [emergencyOnly, setEmergencyOnly] = useState(false);

  useEffect(() => {
    if (!authorized) return;

    let cancelled = false;

    const load = async () => {
      setFetching(true);
      setError(null);
      try {
        const transactions = await adminService.getBidTransactions();
        if (!cancelled) setRows(transactions);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load bid transactions.");
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

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (emergencyOnly && !row.emergency) return false;
      return true;
    });
  }, [rows, statusFilter, emergencyOnly]);

  if (loading || !authorized) {
    return null;
  }

  const forceReject = async (id: string) => {
    setPendingActionId(id);
    setError(null);
    try {
      await adminService.forceRejectBid(id);
      setRows((prev) =>
        prev.map((row) =>
          row.id === id ? { ...row, status: "rejected", flagged: true, locked: true } : row
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject bid.");
    } finally {
      setPendingActionId(null);
    }
  };

  const toggleFlag = async (id: string, nextFlagged: boolean) => {
    setPendingActionId(id);
    setError(null);
    try {
      await adminService.setBidFlag(id, nextFlagged);
      setRows((prev) =>
        prev.map((row) => (row.id === id ? { ...row, flagged: nextFlagged } : row))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update flag.");
    } finally {
      setPendingActionId(null);
    }
  };

  const toggleLock = async (id: string, nextLocked: boolean) => {
    setPendingActionId(id);
    setError(null);
    try {
      await adminService.setBidLock(id, nextLocked);
      setRows((prev) =>
        prev.map((row) => (row.id === id ? { ...row, locked: nextLocked } : row))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update lock.");
    } finally {
      setPendingActionId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">Bid Transactions</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              Administer bid lifecycle activity and moderation actions.
            </p>
          </div>
          <Link href="/admin" className="text-sm font-semibold text-[#0B74FF] hover:underline">
            Back to Admin Dashboard
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 mb-5 flex items-center gap-2 flex-wrap">
          {(["all", "pending", "accepted", "rejected", "retracted"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                statusFilter === s
                  ? "bg-[#0B74FF] text-white border-[#0B74FF]"
                  : "bg-white text-[#374151] border-[#E5E7EB] hover:border-blue-300"
              }`}
            >
              {s}
            </button>
          ))}
          <button
            onClick={() => setEmergencyOnly((v) => !v)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
              emergencyOnly
                ? "bg-red-50 text-red-700 border-red-200"
                : "bg-white text-[#374151] border-[#E5E7EB]"
            }`}
          >
            Emergency only
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F9FAFB] text-xs uppercase tracking-wide text-[#6B7280]">
                <tr>
                  <th className="text-left px-4 py-3">Bid</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Created</th>
                  <th className="text-left px-4 py-3">Signals</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#111827]">{row.jobTitle}</p>
                      <p className="text-xs text-[#6B7280]">
                        {row.handymanName} to {row.homeownerName} | RM {row.price}
                      </p>
                    </td>
                    <td className="px-4 py-3">{statusPill(row.status)}</td>
                    <td className="px-4 py-3 text-[#6B7280] text-xs">{fmtDate(row.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-xs">
                        {row.emergency && (
                          <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3" /> Emergency
                          </span>
                        )}
                        {row.flagged && (
                          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            <Shield className="w-3 h-3" /> Flagged
                          </span>
                        )}
                        {row.locked && (
                          <span className="inline-flex items-center gap-1 text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                            <Lock className="w-3 h-3" /> Locked
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => void toggleFlag(row.id, !row.flagged)}
                          disabled={pendingActionId === row.id}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50"
                        >
                          {row.flagged ? "Unflag" : "Flag"}
                        </button>
                        <button
                          onClick={() => void toggleLock(row.id, !row.locked)}
                          disabled={pendingActionId === row.id}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-purple-200 text-purple-700 hover:bg-purple-50"
                        >
                          {row.locked ? "Unlock" : "Lock"}
                        </button>
                        <button
                          onClick={() => void forceReject(row.id)}
                          disabled={pendingActionId === row.id}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                        >
                          Force Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {fetching && (
            <div className="p-8 text-center text-sm text-[#6B7280]">Loading bid transactions...</div>
          )}

          {filtered.length === 0 && (
            <div className="p-8 text-center text-sm text-[#6B7280]">No bid transactions in this filter.</div>
          )}
        </div>

        <p className="text-xs text-[#9CA3AF] mt-4 inline-flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" />
          Actions are applied via admin API endpoints.
        </p>
      </div>
    </div>
  );
}
