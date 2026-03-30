"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Plus,
  Bell,
  HelpCircle,
  ChevronRight,
} from "lucide-react";
import PrimaryButton from "../components/ui/PrimaryButton";
import JobCard from "../components/ui/JobCard";
import type { Job } from "../types";
import { useRequireRole } from "../lib/hooks/useRequireRole";
import { jobsService } from "../lib/api/jobs";

export default function DashboardPage() {
  const { authorized, loading } = useRequireRole("homeowner");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);

  useEffect(() => {
    if (!authorized) return;

    let ignore = false;

    const fetchJobs = async () => {
      setJobsLoading(true);
      try {
        const response = await jobsService.getMyJobs();
        if (!ignore) setJobs(response.data ?? []);
      } catch {
        if (!ignore) setJobs([]);
      } finally {
        if (!ignore) setJobsLoading(false);
      }
    };

    fetchJobs();

    return () => {
      ignore = true;
    };
  }, [authorized]);

  if (loading || !authorized) {
    return null;
  }

  const open = jobs.filter((j) => j.status === "open").length;
  const inProgress = jobs.filter((j) => j.status === "in-progress").length;
  const completed = jobs.filter((j) => j.status === "completed").length;
  const recentJobs = [...jobs]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-[#F7F8FA] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">My Dashboard</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              {open + inProgress} active · {jobs.length} total jobs
            </p>
          </div>
          <Link href="/create-job">
            <PrimaryButton>
              <Plus className="w-4 h-4" /> Post New Job
            </PrimaryButton>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent jobs — 2/3 */}
          <div className="lg:col-span-2 space-y-4">
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
              Recent Jobs
            </p>
            {jobsLoading ? (
              <div className="bg-white rounded-2xl border border-[#E5E7EB] p-12 text-center">
                <p className="text-[#6B7280]">Loading your jobs...</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#E5E7EB] p-12 text-center">
                <p className="text-[#6B7280] mb-4">
                  You haven&apos;t posted any jobs yet.
                </p>
                <Link href="/create-job">
                  <PrimaryButton>Post your first job</PrimaryButton>
                </Link>
              </div>
            ) : (
              recentJobs.map((job) => <JobCard key={job.id} job={job} />)
            )}

            <div className="pt-2">
              <Link
                href="/my-jobs"
                className="text-sm font-semibold text-[#0B74FF] hover:underline"
              >
                View all jobs and manage bids
              </Link>
            </div>
          </div>

          {/* Sidebar — 1/3 */}
          <div className="space-y-4">
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
              Quick Actions
            </p>
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 space-y-1">
              {[
                {
                  href: "/create-job",
                  icon: <Plus className="w-4 h-4 text-[#0B74FF]" />,
                  bg: "bg-blue-50",
                  label: "Post New Job",
                  sub: "Get quotes in minutes",
                },
                {
                  href: "#",
                  icon: <Bell className="w-4 h-4 text-amber-500" />,
                  bg: "bg-amber-50",
                  label: "Notifications",
                  sub: "2 unread alerts",
                },
                {
                  href: "/support",
                  icon: <HelpCircle className="w-4 h-4 text-green-600" />,
                  bg: "bg-green-50",
                  label: "Help Center",
                  sub: "FAQs and support tickets",
                },
              ].map(({ href, icon, bg, label, sub }) => (
                <Link
                  key={label}
                  href={href}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#F7F8FA] transition-colors"
                >
                  <div
                    className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center flex-shrink-0`}
                  >
                    {icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#111827]">{label}</p>
                    <p className="text-xs text-[#6B7280]">{sub}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
                </Link>
              ))}
            </div>

            {/* Status summary */}
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
              <p className="text-sm font-semibold text-[#111827] mb-3">
                Job Summary
              </p>
              {[
                { label: "Open", value: open, color: "bg-green-500" },
                { label: "In Progress", value: inProgress, color: "bg-blue-500" },
                { label: "Completed", value: completed, color: "bg-gray-400" },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  className="flex items-center justify-between py-2.5 border-b border-[#F3F4F6] last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${color}`} />
                    <span className="text-sm text-[#6B7280]">{label}</span>
                  </div>
                  <span className="text-sm font-bold text-[#111827]">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
