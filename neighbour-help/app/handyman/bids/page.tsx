"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Briefcase, CalendarClock } from "lucide-react";
import PrimaryButton from "@/app/components/ui/PrimaryButton";
import StatusBadge from "@/app/components/ui/StatusBadge";
import type { Bid, Job, BidStatus } from "@/app/types";
import { useRequireRole } from "@/app/lib/hooks/useRequireRole";

const HANDYMAN = {
  id: "u2",
  name: "Demo Handyman",
  email: "handyman@neighborhelp.test",
  role: "handyman" as const,
  createdAt: "2026-01-01T00:00:00Z",
  rating: 4.8,
};

const HOMEOWNER = {
  id: "u1",
  name: "Alice Tan",
  email: "alice@example.com",
  role: "homeowner" as const,
  createdAt: "2026-01-01T00:00:00Z",
};

const JOBS: Job[] = [
  {
    id: "10",
    title: "Water heater not working",
    description: "Electric water heater stopped heating.",
    category: "Plumbing",
    location: "Bangsar, Kuala Lumpur",
    budget: 250,
    imageUrls: [],
    status: "open",
    isEmergency: true,
    postedBy: HOMEOWNER,
    createdAt: "2026-03-11T07:00:00Z",
    updatedAt: "2026-03-11T07:00:00Z",
    bidCount: 1,
  },
  {
    id: "11",
    title: "Ceiling fan installation",
    description: "Install one fan in master bedroom.",
    category: "Electrical",
    location: "Damansara, Petaling Jaya",
    budget: 220,
    imageUrls: [],
    status: "in-progress",
    isEmergency: false,
    postedBy: HOMEOWNER,
    createdAt: "2026-03-10T15:30:00Z",
    updatedAt: "2026-03-12T10:20:00Z",
    bidCount: 3,
  },
  {
    id: "12",
    title: "Kitchen cabinet door alignment",
    description: "Two cabinet doors are misaligned.",
    category: "Carpentry",
    location: "Subang Jaya",
    budget: 80,
    imageUrls: [],
    status: "completed",
    isEmergency: false,
    postedBy: HOMEOWNER,
    createdAt: "2026-03-10T10:00:00Z",
    updatedAt: "2026-03-13T09:45:00Z",
    bidCount: 2,
  },
];

const MY_BIDS: Bid[] = [
  {
    id: "b-100",
    jobId: "10",
    handyman: HANDYMAN,
    price: 210,
    estimatedArrival: "2026-03-25T09:00:00Z",
    message: "I can inspect and repair the heater same-day.",
    status: "pending",
    isRecommended: true,
    createdAt: "2026-03-24T08:30:00Z",
  },
  {
    id: "b-101",
    jobId: "11",
    handyman: HANDYMAN,
    price: 180,
    estimatedArrival: "2026-03-24T14:00:00Z",
    message: "I have installed similar fans and can complete in 1-2 hours.",
    status: "accepted",
    isRecommended: false,
    createdAt: "2026-03-23T09:20:00Z",
  },
  {
    id: "b-102",
    jobId: "12",
    handyman: HANDYMAN,
    price: 75,
    estimatedArrival: "2026-03-23T11:00:00Z",
    message: "Can align hinges quickly with proper tools.",
    status: "rejected",
    isRecommended: false,
    createdAt: "2026-03-22T12:10:00Z",
  },
];

const FILTERS: Array<{ label: string; value: "all" | BidStatus }> = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Accepted", value: "accepted" },
  { label: "Rejected", value: "rejected" },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-MY", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HandymanBidsPage() {
  const { authorized, loading } = useRequireRole("handyman");
  const [statusFilter, setStatusFilter] = useState<"all" | BidStatus>("all");

  const filteredBids = useMemo(() => {
    if (statusFilter === "all") return MY_BIDS;
    return MY_BIDS.filter((bid) => bid.status === statusFilter);
  }, [statusFilter]);

  if (loading || !authorized) return null;

  return (
    <div className="min-h-screen bg-[#F7F8FA] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">My Bids</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              Track every submitted bid and its current status.
            </p>
          </div>
          <Link href="/handyman">
            <PrimaryButton>
              Browse New Jobs <ArrowRight className="w-4 h-4" />
            </PrimaryButton>
          </Link>
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-5">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              onClick={() => setStatusFilter(item.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                statusFilter === item.value
                  ? "bg-[#0B74FF] text-white border-[#0B74FF]"
                  : "bg-white text-[#374151] border-[#E5E7EB] hover:border-blue-300"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {filteredBids.map((bid) => {
            const relatedJob = JOBS.find((job) => job.id === bid.jobId);
            if (!relatedJob) return null;

            return (
              <div key={bid.id} className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                  <div>
                    <p className="text-lg font-semibold text-[#111827]">{relatedJob.title}</p>
                    <p className="text-sm text-[#6B7280]">{relatedJob.location}</p>
                  </div>
                  <StatusBadge status={bid.status} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div className="bg-[#F7F8FA] rounded-xl px-3 py-2">
                    <p className="text-xs text-[#6B7280]">Your Bid</p>
                    <p className="text-sm font-semibold text-[#111827]">RM {bid.price}</p>
                  </div>
                  <div className="bg-[#F7F8FA] rounded-xl px-3 py-2">
                    <p className="text-xs text-[#6B7280]">Submitted</p>
                    <p className="text-sm font-semibold text-[#111827]">{fmtDate(bid.createdAt)}</p>
                  </div>
                  <div className="bg-[#F7F8FA] rounded-xl px-3 py-2">
                    <p className="text-xs text-[#6B7280]">ETA</p>
                    <p className="text-sm font-semibold text-[#111827]">{fmtDate(bid.estimatedArrival)}</p>
                  </div>
                </div>

                <p className="text-sm text-[#6B7280] mb-4">{bid.message}</p>

                <div className="flex items-center justify-between pt-3 border-t border-[#F3F4F6]">
                  <div className="text-xs text-[#6B7280] flex items-center gap-3">
                    <span className="inline-flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {relatedJob.category}</span>
                    <span className="inline-flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" /> Job: {relatedJob.status}</span>
                  </div>
                  <Link href={`/jobs/${relatedJob.id}`} className="text-sm font-semibold text-[#0B74FF] hover:underline">
                    View Job
                  </Link>
                </div>
              </div>
            );
          })}

          {filteredBids.length === 0 && (
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-10 text-center">
              <p className="text-[#6B7280] text-sm">No bids in this status yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
