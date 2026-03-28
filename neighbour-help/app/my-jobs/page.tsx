"use client";

import Link from "next/link";
import { Plus, Filter } from "lucide-react";
import type { Job } from "@/app/types";
import PrimaryButton from "@/app/components/ui/PrimaryButton";
import JobCard from "@/app/components/ui/JobCard";
import { useRequireRole } from "@/app/lib/hooks/useRequireRole";
import { useCallback, useEffect, useState } from "react";
import { jobsService } from "../lib/api/jobs";

const MOCK_USER = {
  id: "u1",
  name: "Alice Tan",
  email: "alice@example.com",
  role: "homeowner" as const,
  createdAt: "2026-01-01T00:00:00Z",
};

const MOCK_JOBS: Job[] = [
  {
    id: "201",
    title: "Leaky kitchen faucet",
    description:
      "Persistent dripping from the faucet handle and occasional low pressure.",
    category: "Plumbing",
    location: "Kuala Lumpur",
    budget: 150,
    imageUrls: [],
    status: "open",
    isEmergency: false,
    postedBy: MOCK_USER,
    createdAt: "2026-03-15T10:00:00Z",
    updatedAt: "2026-03-15T10:00:00Z",
    bidCount: 4,
  },
  {
    id: "202",
    title: "Ceiling fan installation",
    description:
      "Install one fan in master bedroom. Existing wiring point available.",
    category: "Electrical",
    location: "Petaling Jaya",
    budget: 220,
    imageUrls: [],
    status: "in-progress",
    isEmergency: false,
    postedBy: MOCK_USER,
    createdAt: "2026-03-13T08:20:00Z",
    updatedAt: "2026-03-16T09:00:00Z",
    bidCount: 3,
  },
  {
    id: "203",
    title: "Cabinet hinge replacement",
    description: "Replace 3 rusted cabinet hinges and align doors properly.",
    category: "Carpentry",
    location: "Shah Alam",
    imageUrls: [],
    status: "completed",
    isEmergency: false,
    postedBy: MOCK_USER,
    createdAt: "2026-03-08T09:00:00Z",
    updatedAt: "2026-03-11T14:30:00Z",
    bidCount: 5,
  },
];

export default function MyJobsPage() {
  // 1. Check authorization
  const { authorized, loading: authLoading } = useRequireRole("homeowner");

  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      console.log("1");

      fetchUserJobs();
    } else {
      console.log("Not authorized yet, skipping API call. Auth State:", {
        authorized,
        authLoading,
      });
    }
  }, [authorized, fetchUserJobs]);

  // If auth check finished and user isn't a homeowner
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
            <button className="px-4 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-sm font-medium text-[#374151] hover:bg-[#F3F4F6] inline-flex items-center gap-2">
              <Filter className="w-4 h-4" /> Filter
            </button>
            <Link href="/create-job">
              <PrimaryButton>
                <Plus className="w-4 h-4" /> Post New Job
              </PrimaryButton>
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      </div>
    </div>
  );
}
