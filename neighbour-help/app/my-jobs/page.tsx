"use client";

import Link from "next/link";
import { Plus, Filter } from "lucide-react";
import type { Job, JobStatus } from "@/app/types";
import PrimaryButton from "@/app/components/ui/PrimaryButton";
import JobCard from "@/app/components/ui/JobCard";
import { useRequireRole } from "@/app/lib/hooks/useRequireRole";
import { useCallback, useEffect, useMemo, useState } from "react";
import { jobsService } from "../lib/api/jobs";

export default function MyJobsPage() {
  // 1. Check authorization
  const { authorized, loading: authLoading } = useRequireRole("homeowner");

  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | JobStatus>("all");

  // 2. Define the fetcher with useCallback to avoid unnecessary re-renders
  const fetchUserJobs = useCallback(async () => {
    try {
      setIsLoading(true);

      const response = await jobsService.getMyJobs();

      if (response && response.jobs) {
        setJobs(response.jobs);
      } else {
        setJobs([]);
      }
    } catch (err) {
      console.error("Failed to fetch:", err);
      setJobs([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 3. Trigger fetch ONLY when authorized is true
  useEffect(() => {
    if (authorized) {
      fetchUserJobs();
    }
  }, [authorized, fetchUserJobs]);

  const filteredJobs = useMemo(() => {
    if (statusFilter === "all") return jobs;
    return jobs.filter((job) => job.status === statusFilter);
  }, [jobs, statusFilter]);

  // If auth check finished and user isn't a homeowner
  if (authLoading) return null;

  if (!authorized) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-bold">Access Denied</h1>
        <p>You must be logged in as a homeowner to view this page.</p>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-[#F7F8FA] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">My Jobs</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              Track all your posted jobs and bids in one place.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-sm font-medium text-[#374151] inline-flex items-center gap-2">
              <Filter className="w-4 h-4" /> Filter
            </button>
            <Link href="/create-job">
              <PrimaryButton>
                <Plus className="w-4 h-4" /> Post New Job
              </PrimaryButton>
            </Link>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {(["all", "open", "in-progress", "completed"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                statusFilter === status
                  ? "bg-[#0B74FF] text-white border-[#0B74FF]"
                  : "bg-white text-[#374151] border-[#E5E7EB] hover:border-blue-300"
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {filteredJobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}

          {!isLoading && filteredJobs.length === 0 && (
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-10 text-center">
              <p className="text-[#6B7280] text-sm">No jobs found for this filter.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
