"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Send } from "lucide-react";
import { useRequireRole } from "@/app/lib/hooks/useRequireRole";
import { reportsService } from "@/app/lib/api/reports";
import type { ReportStatus, UserReport } from "@/app/types";

type ReportFilter = "all" | ReportStatus;

function statusPill(status: ReportStatus) {
  const styleMap: Record<ReportStatus, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    reviewed: "bg-blue-50 text-blue-700 border-blue-200",
    resolved: "bg-green-50 text-green-700 border-green-200",
  };

  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styleMap[status]}`}>
      {status}
    </span>
  );
}

function formatDate(iso?: string) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ReportsPageContent() {
  const { authorized, loading, user } = useRequireRole(["homeowner", "handyman", "admin"]);
  const searchParams = useSearchParams();

  const [targetUserId, setTargetUserId] = useState("");
  const [targetUserName, setTargetUserName] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");

  const [reports, setReports] = useState<UserReport[]>([]);
  const [fetching, setFetching] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReportFilter>("all");

  const hasSelectedTarget = targetUserId.trim().length > 0;

  useEffect(() => {
    const targetFromQuery = searchParams.get("targetUserId") ?? "";
    const targetNameFromQuery = searchParams.get("targetName") ?? "";

    setTargetUserId(targetFromQuery);
    setTargetUserName(targetNameFromQuery);
  }, [searchParams]);

  useEffect(() => {
    if (!authorized) return;

    let cancelled = false;

    const load = async () => {
      setFetching(true);
      setError(null);
      try {
        const mine = await reportsService.getMyReports();
        if (!cancelled) setReports(mine);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load your reports.");
          setReports([]);
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

  const visibleReports = useMemo(() => {
    if (filter === "all") return reports;
    return reports.filter((report) => report.status === filter);
  }, [filter, reports]);

  const submitReport = async (e: React.FormEvent) => {
    e.preventDefault();

    const target = targetUserId.trim();
    const reportReason = reason.trim();
    const reportDescription = description.trim();

    if (!target || !reportReason || !reportDescription) {
      setError("Choose a user via a Report action on a job/bid, then provide reason and description.");
      setMessage(null);
      return;
    }

    if (target === user?.id) {
      setError("You cannot report yourself.");
      setMessage(null);
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const successMessage = await reportsService.createReport({
        targetUserId: target,
        reason: reportReason,
        description: reportDescription,
      });

      const mine = await reportsService.getMyReports();
      setReports(mine);
      setReason("");
      setDescription("");
      setMessage(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit report.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !authorized || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">User Reports</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              Report abusive behavior and track your submitted reports.
            </p>
          </div>
          <Link
            href={user.role === "admin" ? "/admin" : user.role === "handyman" ? "/handyman" : "/dashboard"}
            className="text-sm font-semibold text-[#0B74FF] hover:underline"
          >
            Back
          </Link>
        </div>

        {message && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
          <h2 className="text-lg font-semibold text-[#111827] mb-4 inline-flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" /> Submit a Report
          </h2>

          <form onSubmit={submitReport} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1.5">Target User</label>
                <div className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2.5 text-sm text-[#111827]">
                  {hasSelectedTarget ? (targetUserName || "Selected user") : "No target selected"}
                </div>
                <p className="mt-1 text-xs text-[#6B7280]">
                  {hasSelectedTarget
                    ? "Target selected from report action."
                    : "Open a job/bid and use Report to prefill the target user."}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1.5">Reason</label>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. harassment, scam, abusive language"
                  className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#111827] mb-1.5">Description</label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what happened with as much detail as possible."
                className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF] resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !hasSelectedTarget}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0B74FF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#065ed1] disabled:opacity-60"
            >
              <Send className="w-4 h-4" /> {submitting ? "Submitting..." : "Submit Report"}
            </button>
          </form>
        </section>

        <section className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
          <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-semibold text-[#111827]">My Submitted Reports</h2>
            <div className="flex items-center gap-2">
              {(["all", "pending", "reviewed", "resolved"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                    filter === status
                      ? "bg-[#0B74FF] text-white border-[#0B74FF]"
                      : "bg-white text-[#374151] border-[#E5E7EB] hover:border-blue-300"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {fetching ? (
            <p className="text-sm text-[#6B7280]">Loading your reports...</p>
          ) : visibleReports.length === 0 ? (
            <p className="text-sm text-[#6B7280]">No reports found for this filter.</p>
          ) : (
            <div className="space-y-3">
              {visibleReports.map((report) => (
                <div key={report.id} className="rounded-xl border border-[#E5E7EB] p-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-[#111827]">{report.reason}</p>
                    {statusPill(report.status)}
                  </div>
                  <p className="text-sm text-[#6B7280] mt-2">{report.description}</p>
                  <div className="mt-2 text-xs text-[#6B7280] space-y-1">
                    <p>Target: {report.targetUserName}</p>
                    <p>Created: {formatDate(report.createdAtUtc)}</p>
                    <p>Reviewed: {formatDate(report.reviewAtUtc)}</p>
                    {report.adminNotes && <p>Admin note: {report.adminNotes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={null}>
      <ReportsPageContent />
    </Suspense>
  );
}
