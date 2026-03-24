import Link from "next/link";
import { Briefcase, Calendar, ChevronRight, MapPin } from "lucide-react";
import type { Job } from "@/app/types";
import StatusBadge from "./StatusBadge";
import PrimaryButton from "./PrimaryButton";

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

interface JobCardProps {
  job: Job;
  viewHref?: string;
  viewLabel?: string;
}

export default function JobCard({
  job,
  viewHref = `/jobs/${job.id}`,
  viewLabel = "View Job",
}: JobCardProps) {
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
        <Link href={viewHref}>
          <PrimaryButton size="sm" variant="outline">
            {viewLabel} <ChevronRight className="w-3.5 h-3.5" />
          </PrimaryButton>
        </Link>
      </div>
    </div>
  );
}
