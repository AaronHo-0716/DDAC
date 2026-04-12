import { Check, Clock, MessageCircle, Star } from "lucide-react";
import type { Bid } from "@/app/types";
import StatusBadge from "./StatusBadge";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${
            i < Math.floor(rating)
              ? "fill-amber-400 text-amber-400"
              : "text-gray-200 fill-gray-200"
          }`}
        />
      ))}
      <span className="text-xs text-[#6B7280] ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

interface BidCardProps {
  bid: Bid;
  onAccept?: (id: string) => void;
  onMessage?: (id: string) => void;
}

export default function BidCard({ bid, onAccept, onMessage }: BidCardProps) {
  const arrival = new Date(bid.estimatedArrival);
  const accepted = bid.status === "accepted";
  const pending = bid.status === "pending";
  const rejected = bid.status === "rejected";

  return (
    <div
      className={`p-4 rounded-xl border-2 transition-all ${
        bid.isRecommended && pending
          ? "border-[#0B74FF] bg-blue-50/30"
          : accepted
          ? "border-green-400 bg-green-50/30"
          : rejected
          ? "border-red-200 bg-red-50/20"
          : "border-[#E5E7EB] bg-white"
      }`}
    >
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <StatusBadge status={bid.status} />
        {bid.isRecommended && pending && (
          <>
            <StatusBadge status="recommended" />
            <span className="text-xs text-[#0B74FF]">Best value for this job</span>
          </>
        )}
      </div>

      {accepted && (
        <div className="mb-3">
          <p className="text-xs text-green-700 font-medium">
            This bid is currently selected for the job.
          </p>
        </div>
      )}

      {rejected && (
        <div className="mb-3">
          <p className="text-xs text-red-700 font-medium">
            This bid has been rejected.
          </p>
        </div>
      )}

      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-[#0B74FF] text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
          {bid.handyman.name.charAt(0)}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-[#111827] text-sm">{bid.handyman.name}</p>
          <StarRating rating={bid.handyman.rating ?? 0} />
        </div>
        <p className="text-xl font-bold text-[#111827]">RM {bid.price}</p>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-[#6B7280] mb-3">
        <Clock className="w-3 h-3" />
        Available{" "}
        {arrival.toLocaleDateString("en-MY", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>

      <p className="text-sm text-[#6B7280] mb-4 line-clamp-3">{bid.message}</p>

      {pending && (
        <div className="flex gap-2">
          <button
            onClick={() => onMessage?.(bid.id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#111827] hover:bg-[#F7F8FA] transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" /> Message
          </button>
          <button
            onClick={() => onAccept?.(bid.id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#0B74FF] text-white rounded-lg text-sm font-medium hover:bg-[#0056CC] transition-colors"
          >
            <Check className="w-3.5 h-3.5" /> Accept
          </button>
        </div>
      )}
    </div>
  );
}
