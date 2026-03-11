"use client";

import Link from "next/link";
import {
  Plus,
  Bell,
  HelpCircle,
  ChevronRight,
  Briefcase,
  MapPin,
  Calendar,
} from "lucide-react";
import PrimaryButton from "../components/ui/PrimaryButton";
import StatusBadge from "../components/ui/StatusBadge";
import type { Job } from "../types";

// ─── Mock data — replace with: const jobs = await jobsService.getMyJobs() ────
const MOCK_USER = {
  id: "u1",
  name: "Alice Tan",
  email: "alice@example.com",
  role: "homeowner" as const,
  createdAt: "2026-01-01T00:00:00Z",
};

const MOCK_JOBS: Job[] = [
  {
    id: "1",
    title: "Leaky kitchen faucet",
    description:
      "My kitchen faucet has been dripping for a week. Looking for a plumber to fix it quickly.",
    category: "Plumbing",
    location: "Kuala Lumpur",
    budget: 150,
    imageUrls: [],
    status: "open",
    isEmergency: false,
    postedBy: MOCK_USER,
    createdAt: "2026-03-09T10:00:00Z",
    updatedAt: "2026-03-09T10:00:00Z",
    bidCount: 4,
  },
  {
    id: "2",
    title: "Broken electrical outlet in bedroom",
    description:
      "One outlet stopped working after a power surge. Needs urgent inspection.",
    category: "Electrical",
    location: "Petaling Jaya",
    budget: 200,
    imageUrls: [],
    status: "in-progress",
    isEmergency: true,
    postedBy: MOCK_USER,
    createdAt: "2026-03-08T14:00:00Z",
    updatedAt: "2026-03-09T08:00:00Z",
    bidCount: 2,
  },
  {
    id: "3",
    title: "Cabinet door hinge replacement",
    description: "Three kitchen cabinet doors need their hinges replaced.",
    category: "Carpentry",
    location: "Shah Alam",
    imageUrls: [],
    status: "completed",
    isEmergency: false,
    postedBy: MOCK_USER,
    createdAt: "2026-03-05T09:00:00Z",
    updatedAt: "2026-03-07T11:00:00Z",
    bidCount: 5,
  },
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
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function JobCard({ job }: { job: Job }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
          {CATEGORY_EMOJI[job.category] ?? "🏠"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-[#111827]">{job.title}</h3>
            {job.isEmergency && <StatusBadge status="emergency" />}
          </div>
          <div className="flex items-center gap-3 text-xs text-[#6B7280] flex-wrap">
            <span className="flex items-center gap-1">
              <Briefcase className="w-3 h-3" />
              {job.category}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {timeAgo(job.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {job.location}
            </span>
          </div>
        </div>
        <StatusBadge status={job.status} className="flex-shrink-0" />
      </div>

      <p className="text-sm text-[#6B7280] mt-3 line-clamp-2">{job.description}</p>

      <div className="mt-4 flex items-center justify-between pt-4 border-t border-[#F3F4F6]">
        <span className="text-sm text-[#6B7280]">
          <span className="font-semibold text-[#111827]">{job.bidCount}</span>{" "}
          {job.bidCount === 1 ? "bid" : "bids"} received
        </span>
        <Link href={`/jobs/${job.id}`}>
          <PrimaryButton size="sm" variant="outline">
            View Job <ChevronRight className="w-3.5 h-3.5" />
          </PrimaryButton>
        </Link>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const open = MOCK_JOBS.filter((j) => j.status === "open").length;
  const inProgress = MOCK_JOBS.filter((j) => j.status === "in-progress").length;
  const completed = MOCK_JOBS.filter((j) => j.status === "completed").length;

  return (
    <div className="min-h-screen bg-[#F7F8FA] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">My Dashboard</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              {open + inProgress} active · {MOCK_JOBS.length} total jobs
            </p>
          </div>
          <Link href="/create-job">
            <PrimaryButton>
              <Plus className="w-4 h-4" /> Post New Job
            </PrimaryButton>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Job list — 2/3 */}
          <div className="lg:col-span-2 space-y-4">
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
              Your Jobs
            </p>
            {MOCK_JOBS.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#E5E7EB] p-12 text-center">
                <p className="text-[#6B7280] mb-4">
                  You haven&apos;t posted any jobs yet.
                </p>
                <Link href="/create-job">
                  <PrimaryButton>Post your first job</PrimaryButton>
                </Link>
              </div>
            ) : (
              MOCK_JOBS.map((job) => <JobCard key={job.id} job={job} />)
            )}
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
