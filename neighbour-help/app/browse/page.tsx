import Link from "next/link";
import { Search, MapPin, Clock, ChevronRight } from "lucide-react";
import type { Job, JobCategory } from "@/app/types";
import StatusBadge from "@/app/components/ui/StatusBadge";

const jobs: (Job & { distanceKm: number })[] = [
  {
    id: "301",
    title: "Water heater troubleshooting",
    description: "Shower water stays cold. Need diagnosis and repair if required.",
    category: "Plumbing",
    location: "Bangsar, Kuala Lumpur",
    budget: 260,
    imageUrls: [],
    status: "open",
    isEmergency: true,
    postedBy: {
      id: "u2",
      name: "Zara Lee",
      email: "zara@example.com",
      role: "homeowner",
      createdAt: "2025-01-10T00:00:00Z",
    },
    createdAt: "2026-03-20T08:30:00Z",
    updatedAt: "2026-03-20T08:30:00Z",
    bidCount: 1,
    distanceKm: 2.4,
  },
  {
    id: "302",
    title: "Replace faulty wall switch",
    description: "One bedroom switch sparks occasionally. Need safe replacement.",
    category: "Electrical",
    location: "Subang Jaya",
    budget: 140,
    imageUrls: [],
    status: "open",
    isEmergency: false,
    postedBy: {
      id: "u3",
      name: "Darren Ng",
      email: "darren@example.com",
      role: "homeowner",
      createdAt: "2025-04-01T00:00:00Z",
    },
    createdAt: "2026-03-19T17:15:00Z",
    updatedAt: "2026-03-19T17:15:00Z",
    bidCount: 3,
    distanceKm: 5.8,
  },
  {
    id: "303",
    title: "Small drywall patch and paint",
    description: "Patch a 30cm wall dent and repaint affected area.",
    category: "General Maintenance",
    location: "Cheras",
    budget: 180,
    imageUrls: [],
    status: "open",
    isEmergency: false,
    postedBy: {
      id: "u4",
      name: "Nadia Ahmad",
      email: "nadia@example.com",
      role: "homeowner",
      createdAt: "2025-02-21T00:00:00Z",
    },
    createdAt: "2026-03-18T09:45:00Z",
    updatedAt: "2026-03-18T09:45:00Z",
    bidCount: 0,
    distanceKm: 8.1,
  },
];

const chips: (JobCategory | "All")[] = [
  "All",
  "Plumbing",
  "Electrical",
  "Carpentry",
  "Appliance Repair",
  "General Maintenance",
];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function BrowsePage() {
  return (
    <div className="min-h-screen bg-[#F7F8FA] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#111827]">Browse Jobs</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">Explore available repair requests from nearby homeowners.</p>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 mb-5">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <input
              placeholder="Search jobs, category, location..."
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B74FF]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <button
                key={chip}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                  chip === "All"
                    ? "bg-[#0B74FF] text-white border-[#0B74FF]"
                    : "bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#0B74FF]"
                }`}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {jobs.map((job) => (
            <article key={job.id} className="bg-white border border-[#E5E7EB] rounded-2xl p-5 hover:shadow-md hover:-translate-y-0.5 transition-all">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h2 className="text-base font-semibold text-[#111827]">{job.title}</h2>
                {job.isEmergency && <StatusBadge status="emergency" />}
              </div>
              <p className="text-sm text-[#6B7280] line-clamp-2 mb-3">{job.description}</p>
              <div className="flex items-center gap-2 text-xs text-[#6B7280] mb-1">
                <MapPin className="w-3 h-3" /> {job.location} · {job.distanceKm} km
              </div>
              <div className="flex items-center gap-2 text-xs text-[#6B7280] mb-3">
                <Clock className="w-3 h-3" /> {timeAgo(job.createdAt)} · {job.category}
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-[#F3F4F6]">
                <span className="text-sm text-[#111827] font-semibold">RM {job.budget ?? "—"}</span>
                <Link href={`/jobs/${job.id}`} className="text-sm font-medium text-[#0B74FF] hover:underline inline-flex items-center gap-1">
                  View Details <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
