"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  DollarSign,
} from "lucide-react";
import PrimaryButton from "../../components/ui/PrimaryButton";
import StatusBadge from "../../components/ui/StatusBadge";
import SubmitBidModal from "../../components/ui/SubmitBidModal";
import BidCard from "../../components/ui/BidCard";
import type { Job, Bid } from "../../types";

// ─── Mock data — replace with: jobsService.getJobById(id) / bidsService.getBidsForJob(id) ─
const MOCK_USER = {
  id: "u1",
  name: "Alice Tan",
  email: "alice@example.com",
  role: "homeowner" as const,
  createdAt: "2026-01-01T00:00:00Z",
};

const MOCK_JOB: Job = {
  id: "1",
  title: "Leaky kitchen faucet",
  description:
    "My kitchen faucet has been dripping continuously for about a week causing water wastage and annoying noise. The drip appears to come from the base of the tap handle. I've tried tightening it myself but the issue persists. Looking for an experienced plumber to diagnose and fix it properly using quality parts.",
  category: "Plumbing",
  location: "Taman Desa, Kuala Lumpur",
  budget: 150,
  imageUrls: [],
  status: "open",
  isEmergency: false,
  postedBy: MOCK_USER,
  createdAt: "2026-03-09T10:00:00Z",
  updatedAt: "2026-03-09T10:00:00Z",
  bidCount: 2,
};

const MOCK_BIDS: Bid[] = [
  {
    id: "b1",
    jobId: "1",
    handyman: {
      id: "h1",
      name: "Mike Rahman",
      email: "mike@example.com",
      role: "handyman",
      rating: 4.9,
      createdAt: "2025-01-01T00:00:00Z",
    },
    price: 95,
    estimatedArrival: "2026-03-12T09:00:00Z",
    message:
      "I can fix this quickly! I have all the parts needed. Been doing plumbing for 8 years with 200+ happy customers.",
    status: "pending",
    isRecommended: true,
    createdAt: "2026-03-09T12:00:00Z",
  },
  {
    id: "b2",
    jobId: "1",
    handyman: {
      id: "h2",
      name: "David Lim",
      email: "david@example.com",
      role: "handyman",
      rating: 4.7,
      createdAt: "2025-06-01T00:00:00Z",
    },
    price: 120,
    estimatedArrival: "2026-03-12T14:00:00Z",
    message:
      "Experienced plumber, 6 years. Will do a thorough inspection and fix properly. Price includes all parts.",
    status: "pending",
    isRecommended: false,
    createdAt: "2026-03-09T14:00:00Z",
  },
];

export default function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [showBidModal, setShowBidModal] = useState(false);
  const [bids, setBids] = useState<Bid[]>(MOCK_BIDS);

  // TODO: const job = await jobsService.getJobById(id)
  const job = MOCK_JOB;
  void id; // used once backend is wired

  const handleAcceptBid = (bidId: string) => {
    // TODO: bidsService.acceptBid(bidId)
    setBids((prev) =>
      prev.map((b) =>
        b.id === bidId ? { ...b, status: "accepted" } : { ...b, status: "rejected" }
      )
    );
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#111827] mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Main content  2/3 ── */}
          <div className="lg:col-span-2 space-y-5">
            {/* Job header */}
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 bg-blue-50 text-[#0B74FF] text-xs font-semibold rounded-full">
                    {job.category}
                  </span>
                  {job.isEmergency && <StatusBadge status="emergency" />}
                  <StatusBadge status={job.status} />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                  <Calendar className="w-3.5 h-3.5" />
                  Posted{" "}
                  {new Date(job.createdAt).toLocaleDateString("en-MY", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>
              <h1 className="text-2xl font-bold text-[#111827] mb-3">
                {job.title}
              </h1>
              <div className="flex items-center gap-5 text-sm text-[#6B7280] flex-wrap">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  {job.location}
                </span>
                {job.budget && (
                  <span className="flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4" />
                    Budget: RM {job.budget}
                  </span>
                )}
              </div>
            </div>

            {/* Image gallery */}
            {job.imageUrls.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
                <p className="text-sm font-semibold text-[#111827] mb-3">
                  Photos
                </p>
                <div className="bg-[#F7F8FA] rounded-xl h-40 flex items-center justify-center text-sm text-[#9CA3AF]">
                  No photos uploaded for this job
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
                <p className="text-sm font-semibold text-[#111827] mb-3">
                  Photos
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {job.imageUrls.map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={url}
                      alt={`Job photo ${i + 1}`}
                      className="rounded-xl h-32 w-full object-cover"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
              <p className="text-sm font-semibold text-[#111827] mb-3">
                Description
              </p>
              <p className="text-[#374151] text-sm leading-relaxed">
                {job.description}
              </p>
            </div>

            {/* CTA for handymen */}
            {job.status === "open" && (
              <div className="bg-[#0B74FF] rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap">
                <div className="text-white">
                  <p className="font-semibold">Are you a handyman?</p>
                  <p className="text-blue-100 text-sm">
                    Submit your bid and win this job
                  </p>
                </div>
                <button
                  onClick={() => setShowBidModal(true)}
                  className="bg-white text-[#0B74FF] font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-blue-50 transition-colors flex-shrink-0"
                >
                  Submit Bid
                </button>
              </div>
            )}
          </div>

          {/* ── Bids sidebar 1/3 ── */}
          <div>
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-3">
              {bids.length} Bid{bids.length !== 1 ? "s" : ""} Received
            </p>
            <div className="space-y-3">
              {bids.map((bid) => (
                <BidCard
                  key={bid.id}
                  bid={bid}
                  onAccept={handleAcceptBid}
                  onMessage={() => {}}
                />
              ))}
              {bids.length === 0 && (
                <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 text-center text-sm text-[#6B7280]">
                  No bids yet. Share your job to get more visibility.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showBidModal && (
        <SubmitBidModal
          jobId={job.id}
          onClose={() => setShowBidModal(false)}
          onSuccess={() => setShowBidModal(false)}
        />
      )}
    </div>
  );
}
