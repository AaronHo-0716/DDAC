"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Eye, FileWarning } from "lucide-react";
import { useRequireRole } from "@/app/lib/hooks/useRequireRole";
import { adminService } from "@/app/lib/api/admin";
import type { ReportStatus, UserReport } from "@/app/types";

type ReportFilter = "all" | ReportStatus;

function statusPill(status: ReportStatus) {
  const styleMap: Record<ReportStatus, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    reviewed: "bg-blue-50 text-blue-700 border-blue-200",
    resolved: "bg-green-50 text-green-700 border-green-200",
  };

  return (
    <span
      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styleMap[status]}`}
    >
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

export default function AdminReportsPage() {
  const { authorized, loading } = useRequireRole("admin");
  const [reports, setReports] = useState<UserReport[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReportFilter>("all");
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  useEffect(() => {
    if (!authorized) return;

    let cancelled = false;

    const load = async () => {
      setFetching(true);
      setError(null);
      try {
        const list = await adminService.getReports(filter === "all" ? undefined : filter);
        if (!cancelled) setReports(list);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load reports.");
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
  }, [authorized, filter]);

  const counts = useMemo(() => {
    return {
      pending: reports.filter((r) => r.status === "pending").length,
      reviewed: reports.filter((r) => r.status === "reviewed").length,
      resolved: reports.filter((r) => r.status === "resolved").length,
    };
  }, [reports]);

  const runAction = async (reportId: string, action: "review" | "resolve") => {
    const notePrompt =
      action === "resolve"
        ? "Add resolution note for this report:"
        : "Add review note for this report:";

    const notes = window.prompt(notePrompt, "");
    if (notes === null) return;

    setPendingActionId(reportId);
    setError(null);

    try {
      if (action === "resolve") {
        await adminService.resolveReport(reportId, notes);
        setReports((prev) =>
          prev.map((report) =>
            report.id === reportId
              ? {
                  ...report,
                  status: "resolved",
                  adminNotes: notes,
                  reviewAtUtc: new Date().toISOString(),
                }
              : report
          )
        );
      } else {
        await adminService.reviewReport(reportId, notes);
        setReports((prev) =>
          prev.map((report) =>
            report.id === reportId
              ? {
                  ...report,
                  status: "reviewed",
                  adminNotes: notes,
                  reviewAtUtc: new Date().toISOString(),
                }
              : report
          )
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update report.");
    } finally {
      setPendingActionId(null);
    }
  };

  if (loading || !authorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">Report Management</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              Review, track, and resolve user reports.
            </p>
          </div>
          <Link href="/admin" className="text-sm font-semibold text-[#0B74FF] hover:underline">
            Back to Admin Dashboard
          </Link>
        </div>

        <div className="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
            <p className="text-xs text-[#6B7280]">Pending</p>
            <p className="text-xl font-bold text-amber-700">{counts.pending}</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
            <p className="text-xs text-[#6B7280]">Reviewed</p>
            <p className="text-xl font-bold text-blue-700">{counts.reviewed}</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
            <p className="text-xs text-[#6B7280]">Resolved</p>
            <p className="text-xl font-bold text-green-700">{counts.resolved}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 mb-5 flex items-center gap-2 flex-wrap">
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
                  <th className="text-left px-4 py-3">Report</th>
                  <th className="text-left px-4 py-3">Reporter</th>
                  <th className="text-left px-4 py-3">Target</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Reviewed At</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td className="px-4 py-3 align-top">
                      <div className="max-w-md">
                        <p className="font-semibold text-[#111827] inline-flex items-center gap-1">
                          <FileWarning className="w-4 h-4 text-amber-600" /> {report.reason}
                        </p>
                        <p className="text-xs text-[#6B7280] mt-1 whitespace-pre-wrap">{report.description}</p>
                        <p className="text-xs text-[#9CA3AF] mt-1">Created {formatDate(report.createdAtUtc)}</p>
                        {report.adminNotes && (
                          <p className="text-xs text-[#4B5563] mt-2">Admin note: {report.adminNotes}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="font-medium text-[#111827]">{report.reporterName}</p>
                      <p className="text-xs text-[#6B7280]">{report.reporterId}</p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="font-medium text-[#111827]">{report.targetUserName}</p>
                      <p className="text-xs text-[#6B7280]">{report.targetUserId}</p>
                    </td>
                    <td className="px-4 py-3 align-top">{statusPill(report.status)}</td>
                    <td className="px-4 py-3 align-top text-xs text-[#6B7280]">
                      {formatDate(report.reviewAtUtc)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-2 flex-wrap">
                        {report.status === "pending" && (
                          <button
                            onClick={() => void runAction(report.id, "review")}
                            disabled={pendingActionId === report.id}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 inline-flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> Review
                          </button>
                        )}

                        {report.status !== "resolved" && (
                          <button
                            onClick={() => void runAction(report.id, "resolve")}
                            disabled={pendingActionId === report.id}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 inline-flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                          </button>
                        )}

                        {report.status === "resolved" && (
                          <span className="text-xs text-[#6B7280] inline-flex items-center gap-1">
                            <ClipboardList className="w-3.5 h-3.5" /> Closed
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {fetching && <div className="p-8 text-center text-sm text-[#6B7280]">Loading reports...</div>}

          {!fetching && reports.length === 0 && (
            <div className="p-8 text-center text-sm text-[#6B7280]">No reports found for this filter.</div>
          )}
        </div>
      </div>
    </div>
  );
}
