"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  ChevronRight,
  Filter,
  Zap,
} from "lucide-react";
import PrimaryButton from "../components/ui/PrimaryButton";
import StatusBadge from "../components/ui/StatusBadge";
import type { Job, JobCategory } from "../types";
import { useRequireRole } from "../lib/hooks/useRequireRole";
import { jobsService } from "../lib/api/jobs";

const ALL_CATEGORIES: JobCategory[] = [
  "Plumbing",
  "Electrical",
  "Carpentry",
  "Appliance Repair",
  "General Maintenance",
];

const CATEGORY_EMOJI: Record<string, string> = {
  Plumbing: "🔧",
  Electrical: "⚡",
  Carpentry: "🪚",
  "Appliance Repair": "🔌",
  "General Maintenance": "🏠",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function JobFeedCard({
  job,
}: {
  job: Job;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
          {CATEGORY_EMOJI[job.category]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-[#111827] leading-snug">
              {job.title}
            </h3>
            {job.isEmergency && <StatusBadge status="emergency" />}
          </div>
          <div className="flex items-center gap-3 text-xs text-[#6B7280] flex-wrap">
            <span className="px-2 py-0.5 bg-[#F7F8FA] rounded-full font-medium">
              {job.category}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo(job.createdAt)}
            </span>
          </div>
        </div>
      </div>

      <p className="text-sm text-[#6B7280] mt-3 mb-1 line-clamp-2">
        {job.description}
      </p>
        {job.imageUrls.length > 0 && (
          <div className="mt-3 mb-1 overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] relative">
            <img
              src={job.imageUrls[0]}
              alt={`${job.title} image`}
              className="h-40 w-full object-cover"
              loading="lazy"
            />
            {job.imageUrls.length > 1 && (
              <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
                +{job.imageUrls.length - 1}
              </span>
            )}
          </div>
        )}
      {job.budget && (
        <p className="text-xs text-[#6B7280] mb-4">
          Budget:{" "}
          <span className="font-semibold text-[#111827]">RM {job.budget}</span>
        </p>
      )}

      <div className="flex items-center gap-2 pt-4 border-t border-[#F3F4F6]">
        <Link href={`/jobs/${job.id}`} className="flex-1">
          <PrimaryButton size="sm" variant="secondary" fullWidth>
            View Details <ChevronRight className="w-3.5 h-3.5" />
          </PrimaryButton>
        </Link>
      </div>
    </div>
  );
}

export default function HandymanPage() {
  const { authorized, loading, user } = useRequireRole("handyman");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<JobCategory | "">("");
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const verificationStatus = user?.verification ?? "pending";
  const isApproved = verificationStatus === "approved";

  useEffect(() => {
    if (!authorized) return;

    let ignore = false;

    const fetchJobs = async () => {
      setJobsLoading(true);
      setError(null);
      try {
        const response = await jobsService.getJobs({
          status: "open",
          category: categoryFilter || undefined,
          isEmergency: emergencyOnly ? true : undefined,
          pageSize: 50,
        });
        if (!ignore) setJobs(response.jobs ?? []);
      } catch (err) {
        if (!ignore) {
          setJobs([]);
          setError(err instanceof Error ? err.message : "Unable to load jobs.");
        }
      } finally {
        if (!ignore) setJobsLoading(false);
      }
    };

    fetchJobs();

    return () => {
      ignore = true;
    };
  }, [authorized, categoryFilter, emergencyOnly]);

  const activeFilterCount =
    (categoryFilter ? 1 : 0) + (emergencyOnly ? 1 : 0);

  if (loading || !authorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">
              Jobs Near You
            </h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              {jobs.length} open job{jobs.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
              showFilters || activeFilterCount > 0
                ? "bg-[#0B74FF] text-white border-[#0B74FF]"
                : "bg-white text-[#111827] border-[#E5E7EB] hover:bg-[#F7F8FA]"
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-white text-[#0B74FF] text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {!isApproved && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-start gap-2 text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="text-sm font-semibold">
                  {verificationStatus === "rejected"
                    ? "Account verification rejected"
                    : "Account verification pending"}
                </p>
                {verificationStatus === "rejected" ? (
                  <p className="mt-1 text-sm">
                    Your handyman verification was rejected. You can browse jobs,
                    but bid submission is disabled. Please contact support or an admin.
                  </p>
                ) : (
                  <p className="mt-1 text-sm">
                    Your handyman account has not been verified yet. You can browse jobs,
                    but you cannot place bids until verification is approved.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Filter panel */}
        {showFilters && (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 mb-6 space-y-4">
            {/* Category */}
            <div>
              <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">
                Category
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setCategoryFilter("")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    categoryFilter === ""
                      ? "bg-[#0B74FF] text-white border-[#0B74FF]"
                      : "bg-white text-[#6B7280] border-[#E5E7EB] hover:border-blue-300"
                  }`}
                >
                  All
                </button>
                {ALL_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      categoryFilter === cat
                        ? "bg-[#0B74FF] text-white border-[#0B74FF]"
                        : "bg-white text-[#6B7280] border-[#E5E7EB] hover:border-blue-300"
                    }`}
                  >
                    {CATEGORY_EMOJI[cat]} {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Emergency toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-red-500" />
                <p className="text-sm font-medium text-[#111827]">
                  Emergency jobs only
                </p>
              </div>
              <button
                onClick={() => setEmergencyOnly(!emergencyOnly)}
                className={`w-11 h-6 rounded-full transition-colors relative ${
                  emergencyOnly ? "bg-red-500" : "bg-[#E5E7EB]"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    emergencyOnly ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {activeFilterCount > 0 && (
              <button
                onClick={() => {
                  setCategoryFilter("");
                  setEmergencyOnly(false);
                }}
                className="text-xs text-[#6B7280] hover:text-[#111827] underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Feed */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {jobsLoading ? (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-12 text-center">
            <p className="text-[#6B7280] text-sm">Loading jobs...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-12 text-center">
            <p className="text-[#6B7280] text-sm">
              No jobs match your current filters.
            </p>
            <button
              onClick={() => {
                setCategoryFilter("");
                setEmergencyOnly(false);
              }}
              className="text-[#0B74FF] text-sm font-medium mt-2 hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {jobs.map((job) => (
              <JobFeedCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
