"use client";

import Link from "next/link";
import { CheckCircle2, Clock3, Hammer, ArrowRight } from "lucide-react";
import PrimaryButton from "@/app/components/ui/PrimaryButton";
import StatusBadge from "@/app/components/ui/StatusBadge";
import type { Job } from "@/app/types";
import { useRequireRole } from "@/app/lib/hooks/useRequireRole";

function SectionCard({
  title,
  icon,
  jobs,
}: {
  title: string;
  icon: React.ReactNode;
  jobs: Job[];
}) {
  return (
    <section className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-[#111827] inline-flex items-center gap-2">
          {icon}
          {title}
        </h2>
        <span className="text-xs text-[#6B7280] font-semibold">{jobs.length} job{jobs.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="space-y-3">
        {jobs.length === 0 && (
          <div className="rounded-xl border border-dashed border-[#E5E7EB] px-4 py-6 text-center text-sm text-[#6B7280]">
            No jobs in this section.
          </div>
        )}

        {jobs.map((job) => (
          <div key={job.id} className="rounded-xl border border-[#E5E7EB] p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-[#111827]">{job.title}</p>
                <p className="text-xs text-[#6B7280] mt-0.5">{job.location} • {job.category}</p>
              </div>
              <StatusBadge status={job.status} />
            </div>

            <p className="text-sm text-[#6B7280] mt-3 line-clamp-2">{job.description}</p>

            <div className="mt-3 pt-3 border-t border-[#F3F4F6] flex items-center justify-between">
              <span className="text-xs text-[#6B7280]">Updated {new Date(job.updatedAt).toLocaleDateString("en-MY")}</span>
              <Link href={`/jobs/${job.id}`} className="text-sm font-semibold text-[#0B74FF] hover:underline">
                View Job
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function HandymanActiveJobsPage() {
  const { authorized, loading } = useRequireRole("handyman");
  const jobs: Job[] = [];

  if (loading || !authorized) return null;

  const accepted = jobs.filter((job) => job.status === "open");
  const inProgress = jobs.filter((job) => job.status === "in-progress");
  const completed = jobs.filter((job) => job.status === "completed");

  return (
    <div className="min-h-screen bg-[#F7F8FA] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">Active Jobs</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">Monitor accepted jobs and completion status.</p>
          </div>
          <Link href="/handyman">
            <PrimaryButton>
              Find More Jobs <ArrowRight className="w-4 h-4" />
            </PrimaryButton>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5">
          <SectionCard
            title="Accepted"
            icon={<Clock3 className="w-4 h-4 text-amber-500" />}
            jobs={accepted}
          />
          <SectionCard
            title="In Progress"
            icon={<Hammer className="w-4 h-4 text-[#0B74FF]" />}
            jobs={inProgress}
          />
          <SectionCard
            title="Completed"
            icon={<CheckCircle2 className="w-4 h-4 text-green-600" />}
            jobs={completed}
          />
        </div>
      </div>
    </div>
  );
}
