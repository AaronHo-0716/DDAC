"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search, MapPin, Clock, ChevronRight } from "lucide-react";
import type { Job, JobCategory } from "@/app/types";
import StatusBadge from "@/app/components/ui/StatusBadge";
import { jobsService } from "@/app/lib/api/jobs";

const chips: (JobCategory | "All")[] = [
  "All",
  "Plumbing",
  "Electrical",
  "Carpentry",
  "Appliance Repair",
  "General Maintenance",
];

const PAGE_SIZE = 9;

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function BrowsePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<JobCategory | "All">("All");
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [maxDistance, setMaxDistance] = useState("");

  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(id);
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await jobsService.getJobs({
          page,
          pageSize: PAGE_SIZE,
          status: "open",
          search: debouncedSearch || undefined,
          category: category === "All" ? undefined : category,
          isEmergency: emergencyOnly ? true : undefined,
          maxDistanceKm: maxDistance.trim() ? Number(maxDistance) : undefined,
        });

        if (!cancelled) {
          setJobs(response.jobs ?? []);
          setTotalCount(response.totalCount ?? 0);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load jobs.");
          setJobs([]);
          setTotalCount(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch, category, emergencyOnly, maxDistance]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)), [totalCount]);

  return (
    <div className="min-h-screen bg-[#F7F8FA] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#111827]">Browse Jobs</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            Explore available repair requests from nearby homeowners.
          </p>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 mb-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
              <input
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
                placeholder="Search jobs, category, location..."
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B74FF]"
              />
            </div>
            <input
              type="number"
              min={1}
              value={maxDistance}
              onChange={(e) => {
                setPage(1);
                setMaxDistance(e.target.value);
              }}
              placeholder="Max distance (km)"
              className="w-full px-4 py-2.5 text-sm border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B74FF]"
            />
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            {chips.map((chip) => (
              <button
                key={chip}
                onClick={() => {
                  setPage(1);
                  setCategory(chip);
                }}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                  category === chip
                    ? "bg-[#0B74FF] text-white border-[#0B74FF]"
                    : "bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#0B74FF]"
                }`}
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <label className="inline-flex items-center gap-2 text-sm text-[#111827]">
              <input
                type="checkbox"
                checked={emergencyOnly}
                onChange={(e) => {
                  setPage(1);
                  setEmergencyOnly(e.target.checked);
                }}
              />
              Emergency only
            </label>
            <button
              onClick={() => {
                setPage(1);
                setSearch("");
                setDebouncedSearch("");
                setCategory("All");
                setEmergencyOnly(false);
                setMaxDistance("");
              }}
              className="text-xs text-[#6B7280] hover:text-[#111827] underline"
            >
              Clear filters
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-12 text-center">
            <p className="text-[#6B7280] text-sm">Loading jobs...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-12 text-center">
            <p className="text-[#6B7280] text-sm">No jobs found for the selected filters.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {jobs.map((job) => (
                <article
                  key={job.id}
                  className="bg-white border border-[#E5E7EB] rounded-2xl p-5 hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h2 className="text-base font-semibold text-[#111827]">{job.title}</h2>
                    {job.isEmergency && <StatusBadge status="emergency" />}
                  </div>
                  <p className="text-sm text-[#6B7280] line-clamp-2 mb-3">{job.description}</p>
                  <div className="flex items-center gap-2 text-xs text-[#6B7280] mb-1">
                    <MapPin className="w-3 h-3" /> {job.location}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#6B7280] mb-3">
                    <Clock className="w-3 h-3" /> {timeAgo(job.createdAt)} · {job.category}
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-[#F3F4F6]">
                    <span className="text-sm text-[#111827] font-semibold">RM {job.budget ?? "—"}</span>
                    <Link
                      href={`/jobs/${job.id}`}
                      className="text-sm font-medium text-[#0B74FF] hover:underline inline-flex items-center gap-1"
                    >
                      View Details <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm text-[#6B7280]">
                Showing page {page} of {totalPages} ({totalCount} results)
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-sm text-[#374151] disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-sm text-[#374151] disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
