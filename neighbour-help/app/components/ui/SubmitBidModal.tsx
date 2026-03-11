"use client";

import { useState } from "react";
import { X, DollarSign, Calendar, MessageCircle } from "lucide-react";
import PrimaryButton from "./PrimaryButton";
import { ApiClientError } from "@/app/lib/api/client";
import { bidsService } from "@/app/lib/api/bids";

interface SubmitBidModalProps {
  jobId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SubmitBidModal({
  jobId,
  onClose,
  onSuccess,
}: SubmitBidModalProps) {
  const [price, setPrice] = useState("");
  const [arrivalDate, setArrivalDate] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = price.trim() !== "" && arrivalDate !== "" && message.trim() !== "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);

    try {
      await bidsService.createBid({
        jobId,
        price: Number(price),
        estimatedArrival: new Date(arrivalDate).toISOString(),
        message,
      });
      onSuccess();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xl w-full max-w-md pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
            <div>
              <h2 className="text-lg font-bold text-[#111827]">Submit a Bid</h2>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Send your best offer to the homeowner
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F7F8FA] hover:text-[#111827] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Price */}
            <div>
              <label className="block text-sm font-medium text-[#111827] mb-1.5">
                Price Estimate <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                <input
                  type="number"
                  min={1}
                  required
                  placeholder="e.g. 120"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-[#E5E7EB] rounded-xl text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0B74FF] focus:border-transparent"
                />
              </div>
            </div>

            {/* Arrival time */}
            <div>
              <label className="block text-sm font-medium text-[#111827] mb-1.5">
                Estimated Arrival <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                <input
                  type="datetime-local"
                  required
                  value={arrivalDate}
                  onChange={(e) => setArrivalDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-[#E5E7EB] rounded-xl text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#0B74FF] focus:border-transparent"
                />
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-[#111827] mb-1.5">
                Message <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <MessageCircle className="absolute left-3 top-3 w-4 h-4 text-[#6B7280]" />
                <textarea
                  rows={3}
                  required
                  placeholder="Briefly describe your experience and approach for this job…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-[#E5E7EB] rounded-xl text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0B74FF] focus:border-transparent resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <PrimaryButton
                type="button"
                variant="secondary"
                fullWidth
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </PrimaryButton>
              <PrimaryButton
                type="submit"
                fullWidth
                disabled={!canSubmit || submitting}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Submitting…
                  </span>
                ) : (
                  "Submit Bid"
                )}
              </PrimaryButton>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
