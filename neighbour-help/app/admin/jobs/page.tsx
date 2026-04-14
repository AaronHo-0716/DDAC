"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Briefcase, Clock3, CheckCircle2, Search } from "lucide-react";
import StatusBadge from "@/app/components/ui/StatusBadge";
import { jobsService } from "@/app/lib/api/jobs";
import { useRequireRole } from "@/app/lib/hooks/useRequireRole";
import type { Job, JobStatus } from "@/app/types";

function formatDate(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminJobsPage() {
  const { authorized, loading } = useRequireRole("admin");

  const [jobs, setJobs] = useState<Job[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<"all" | JobStatus>("all");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [emergencyOnly, setEmergencyOnly] = useState(false);

  useEffect(() => {
    if (!authorized) return;

    let cancelled = false;

    const load = async () => {
      setFetching(true);
      setError(null);
      try {
        const response = await jobsService.getJobs({
          page: 1,
          pageSize: 200,
          status: statusFilter === "all" ? undefined : statusFilter,
          search: appliedSearch.trim() || undefined,
          isEmergency: emergencyOnly ? true : undefined,
        });

        if (!cancelled) {
          setJobs(response.jobs);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load jobs.");
          setJobs([]);
        }
      } finally {
        if (!cancelled) setFetching(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [authorized, statusFilter, appliedSearch, emergencyOnly]);

  const progress = useMemo(() => {
    const total = jobs.length;
    const open = jobs.filter((j) => j.status === "open").length;
    const inProgress = jobs.filter((j) => j.status === "in-progress").length;
    const completed = jobs.filter((j) => j.status === "completed").length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, open, inProgress, completed, completionRate };
  }, [jobs]);

  if (loading || !authorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">Jobs Oversight</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">View all posted jobs and monitor their current progress.</p>
          </div>
          <Link href="/admin" className="text-sm font-semibold text-[#0B74FF] hover:underline">
            Back to Admin Dashboard
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
            <p className="text-xs text-[#6B7280]">Total Jobs</p>
            <p className="mt-1 text-2xl font-bold text-[#111827]">{progress.total}</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
            <p className="text-xs text-[#6B7280]">Open</p>
            <p className="mt-1 text-2xl font-bold text-green-700">{progress.open}</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
            <p className="text-xs text-[#6B7280]">In Progress</p>
            <p className="mt-1 text-2xl font-bold text-blue-700">{progress.inProgress}</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
            <p className="text-xs text-[#6B7280]">Completed</p>
            <p className="mt-1 text-2xl font-bold text-[#111827]">{progress.completed}</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
            <p className="text-xs text-[#6B7280]">Completion Rate</p>
            <p className="mt-1 text-2xl font-bold text-[#111827]">{progress.completionRate}%</p>
          </div>
        </div>

        <section className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-5">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by title, description, or location"
                className="w-full rounded-xl border border-[#E5E7EB] pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF]"
              />
            </div>
            <button
              onClick={() => setAppliedSearch(searchInput)}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#0B74FF] text-white hover:bg-[#065ed1]"
            >
              Apply
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {(["all", "open", "in-progress", "completed"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  statusFilter === status
                    ? "bg-[#111827] text-white border-[#111827]"
                    : "bg-white text-[#374151] border-[#E5E7EB] hover:border-blue-300"
                }`}
              >
                {status}
              </button>
            ))}

            <button
              onClick={() => setEmergencyOnly((prev) => !prev)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                emergencyOnly
                  ? "bg-red-50 text-red-700 border-red-200"
                  : "bg-white text-[#374151] border-[#E5E7EB]"
              }`}
            >
              Emergency only
            </button>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                <tr className="text-left text-[#6B7280]">
                  <th className="px-4 py-3 font-semibold">Job</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Owner</th>
                  <th className="px-4 py-3 font-semibold">Bids</th>
                  <th className="px-4 py-3 font-semibold">Updated</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {fetching ? (
                  <tr>
                    <td className="px-4 py-4 text-[#6B7280]" colSpan={6}>
                      Loading jobs...
                    </td>
                  </tr>
                ) : jobs.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-[#6B7280]" colSpan={6}>
                      No jobs found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  jobs.map((job) => (
                    <tr key={job.id} className="border-b border-[#F3F4F6] last:border-0 align-top">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#111827] line-clamp-1">{job.title}</div>
                        <div className="text-xs text-[#6B7280] mt-1 line-clamp-1">{job.location}</div>
                        <div className="text-xs text-[#9CA3AF] mt-1 inline-flex items-center gap-1">
                          <Briefcase className="w-3.5 h-3.5" /> {job.category}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="px-4 py-3 text-[#374151]">
                        <div className="line-clamp-1">{job.postedBy.name}</div>
                        <div className="text-xs text-[#6B7280] line-clamp-1">{job.postedBy.email}</div>
                      </td>
                      <td className="px-4 py-3 text-[#374151]">{job.bidCount}</td>
                      <td className="px-4 py-3 text-[#374151]">
                        <div className="inline-flex items-center gap-1 text-xs">
                          <Clock3 className="w-3.5 h-3.5 text-[#9CA3AF]" />
                          {formatDate(job.updatedAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/jobs/${job.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B74FF] hover:underline"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> View
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
