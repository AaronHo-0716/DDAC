"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MapPin,
  Clock,
  ChevronRight,
  Star,
  Filter,
  Zap,
} from "lucide-react";
import PrimaryButton from "../components/ui/PrimaryButton";
import StatusBadge from "../components/ui/StatusBadge";
import SubmitBidModal from "../components/ui/SubmitBidModal";
import type { Job, JobCategory } from "../types";
import { useRequireRole } from "../lib/hooks/useRequireRole";

// ─── Mock data — replace with: jobsService.getJobs({ ...filters }) ─────────
const MOCK_USER = {
  id: "u2",
  name: "Bob Chen",
  email: "bob@example.com",
  role: "homeowner" as const,
  createdAt: "2026-01-01T00:00:00Z",
};

const MOCK_FEED: (Job & { distanceKm: number })[] = [
  {
    id: "10",
    title: "Water heater not working",
    description:
      "Electric water heater stopped heating. Checked circuit breaker — it's fine. Suspect the heating element needs replacement.",
    category: "Plumbing",
    location: "Bangsar, Kuala Lumpur",
    budget: 250,
    imageUrls: [],
    status: "open",
    isEmergency: true,
    postedBy: MOCK_USER,
    createdAt: "2026-03-11T07:00:00Z",
    updatedAt: "2026-03-11T07:00:00Z",
    bidCount: 1,
    distanceKm: 2.3,
  },
  {
    id: "11",
    title: "Ceiling fan installation",
    description:
      "Need a new ceiling fan installed in the master bedroom. Fan and mounting bracket already purchased, just need the wiring and mounting done.",
    category: "Electrical",
    location: "Damansara, Petaling Jaya",
    imageUrls: [],
    status: "open",
    isEmergency: false,
    postedBy: MOCK_USER,
    createdAt: "2026-03-10T15:30:00Z",
    updatedAt: "2026-03-10T15:30:00Z",
    bidCount: 3,
    distanceKm: 5.1,
  },
  {
    id: "12",
    title: "Kitchen cabinet door alignment",
    description:
      "Two cabinet doors are misaligned after a recent renovation. They don't close properly. Simple hinge adjustment should fix it.",
    category: "Carpentry",
    location: "Subang Jaya",
    budget: 80,
    imageUrls: [],
    status: "open",
    isEmergency: false,
    postedBy: MOCK_USER,
    createdAt: "2026-03-10T10:00:00Z",
    updatedAt: "2026-03-10T10:00:00Z",
    bidCount: 0,
    distanceKm: 8.7,
  },
  {
    id: "13",
    title: "Washing machine not spinning",
    description:
      "Samsung front loader drum stopped spinning mid-cycle. Error code E4 showing on display. Have error code manual but need a technician.",
    category: "Appliance Repair",
    location: "Cheras, Kuala Lumpur",
    budget: 180,
    imageUrls: [],
    status: "open",
    isEmergency: false,
    postedBy: MOCK_USER,
    createdAt: "2026-03-09T20:00:00Z",
    updatedAt: "2026-03-09T20:00:00Z",
    bidCount: 2,
    distanceKm: 11.2,
  },
  {
    id: "14",
    title: "House painting — living room",
    description:
      "Need the living room walls repainted. Area is approx 40 sq meters. Will supply paint. Looking for a clean, professional finish.",
    category: "General Maintenance",
    location: "Ampang, Kuala Lumpur",
    imageUrls: [],
    status: "open",
    isEmergency: false,
    postedBy: MOCK_USER,
    createdAt: "2026-03-09T09:00:00Z",
    updatedAt: "2026-03-09T09:00:00Z",
    bidCount: 5,
    distanceKm: 14.8,
  },
];

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
  onBid,
}: {
  job: (typeof MOCK_FEED)[0];
  onBid: (id: string) => void;
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
              <MapPin className="w-3 h-3" />
              {job.distanceKm} km away
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
        <PrimaryButton
          size="sm"
          variant="primary"
          onClick={() => onBid(job.id)}
          className="flex-1"
        >
          <Star className="w-3.5 h-3.5" /> Submit Bid
        </PrimaryButton>
      </div>
    </div>
  );
}

export default function HandymanPage() {
  const { authorized, loading } = useRequireRole("handyman");
  const [categoryFilter, setCategoryFilter] = useState<JobCategory | "">("");
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [maxDistance, setMaxDistance] = useState(50);
  const [bidJobId, setBidJobId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const filtered = MOCK_FEED.filter((job) => {
    if (categoryFilter && job.category !== categoryFilter) return false;
    if (emergencyOnly && !job.isEmergency) return false;
    if (job.distanceKm > maxDistance) return false;
    return true;
  });

  const activeFilterCount =
    (categoryFilter ? 1 : 0) + (emergencyOnly ? 1 : 0) + (maxDistance < 50 ? 1 : 0);

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
              {filtered.length} open job{filtered.length !== 1 ? "s" : ""} in
              your area
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

            {/* Distance */}
            <div>
              <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">
                Max distance: {maxDistance} km
              </p>
              <input
                type="range"
                min={1}
                max={50}
                value={maxDistance}
                onChange={(e) => setMaxDistance(Number(e.target.value))}
                className="w-full accent-[#0B74FF]"
              />
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
                  setMaxDistance(50);
                }}
                className="text-xs text-[#6B7280] hover:text-[#111827] underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Feed */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-12 text-center">
            <p className="text-[#6B7280] text-sm">
              No jobs match your current filters.
            </p>
            <button
              onClick={() => {
                setCategoryFilter("");
                setEmergencyOnly(false);
                setMaxDistance(50);
              }}
              className="text-[#0B74FF] text-sm font-medium mt-2 hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((job) => (
              <JobFeedCard
                key={job.id}
                job={job}
                onBid={(id) => setBidJobId(id)}
              />
            ))}
          </div>
        )}
      </div>

      {bidJobId && (
        <SubmitBidModal
          jobId={bidJobId}
          onClose={() => setBidJobId(null)}
          onSuccess={() => setBidJobId(null)}
        />
      )}
    </div>
  );
}
