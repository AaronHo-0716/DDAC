"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Briefcase, CalendarClock } from "lucide-react";
import PrimaryButton from "@/app/components/ui/PrimaryButton";
import StatusBadge from "@/app/components/ui/StatusBadge";
import type { Bid, BidStatus } from "@/app/types";
import { useRequireRole } from "@/app/lib/hooks/useRequireRole";
import { bidsService } from "@/app/lib/api/bids";
import { ApiClientError } from "@/app/lib/api/client";

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
  const [myBids, setMyBids] = useState<Bid[]>([]);
  const [isLoadingBids, setIsLoadingBids] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authorized) return;

    let isCancelled = false;

    const loadBids = async () => {
      setIsLoadingBids(true);
      setErrorMessage(null);

      try {
        const response = await bidsService.getMyBids({ page: 1, pageSize: 100 });
        if (!isCancelled) {
          setMyBids(response.bids);
        }
      } catch (error) {
        if (!isCancelled) {
          if (error instanceof ApiClientError) {
            setErrorMessage(error.message || "Failed to load submitted bids.");
          } else {
            setErrorMessage("Failed to load submitted bids.");
          }
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingBids(false);
        }
      }
    };

    loadBids();

    return () => {
      isCancelled = true;
    };
  }, [authorized]);

  const filteredBids = useMemo(() => {
    if (statusFilter === "all") return myBids;
    return myBids.filter((bid) => bid.status === statusFilter);
  }, [myBids, statusFilter]);

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
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          {isLoadingBids && (
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-10 text-center">
              <p className="text-[#6B7280] text-sm">Loading submitted bids...</p>
            </div>
          )}

          {filteredBids.map((bid) => (
            <div key={bid.id} className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                <div>
                  <p className="text-lg font-semibold text-[#111827]">Job #{bid.jobId}</p>
                  <p className="text-sm text-[#6B7280]">Bid tracking</p>
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
                  <span className="inline-flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> Bid</span>
                  <span className="inline-flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" /> Tracking</span>
                </div>
                <Link href={`/jobs/${bid.jobId}`} className="text-sm font-semibold text-[#0B74FF] hover:underline">
                  View Job
                </Link>
              </div>
            </div>
          ))}

          {!isLoadingBids && filteredBids.length === 0 && (
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-10 text-center">
              <p className="text-[#6B7280] text-sm">No bids in this status yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
