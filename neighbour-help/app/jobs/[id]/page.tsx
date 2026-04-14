"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Calendar, DollarSign, MapPin, Pencil, Save, Trash2, X } from "lucide-react";
import type { Bid, Job, JobCategory } from "@/app/types";
import { jobsService } from "@/app/lib/api/jobs";
import { bidsService } from "@/app/lib/api/bids";
import { useAuth } from "@/app/lib/context/AuthContext";
import PrimaryButton from "@/app/components/ui/PrimaryButton";
import StatusBadge from "@/app/components/ui/StatusBadge";
import BidCard from "@/app/components/ui/BidCard";
import SubmitBidModal from "@/app/components/ui/SubmitBidModal";
import { useChatWidget } from "@/app/lib/context/ChatWidgetContext";

const ALL_CATEGORIES: JobCategory[] = [
  "Plumbing",
  "Electrical",
  "Carpentry",
  "Appliance Repair",
  "General Maintenance",
];

interface EditForm {
  title: string;
  description: string;
  category: JobCategory;
  location: string;
  budget: string;
  isEmergency: boolean;
}

function toEditForm(job: Job): EditForm {
  return {
    title: job.title,
    description: job.description,
    category: job.category,
    location: job.location,
    budget: typeof job.budget === "number" ? String(job.budget) : "",
    isEmergency: job.isEmergency,
  };
}

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { openForBidChat } = useChatWidget();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);

  const [bids, setBids] = useState<Bid[]>([]);
  const [bidsLoading, setBidsLoading] = useState(false);
  const [bidsError, setBidsError] = useState<string | null>(null);
  const [bidActionLoadingId, setBidActionLoadingId] = useState<string | null>(null);
  const [bidStatusFilter, setBidStatusFilter] = useState<"all" | Bid["status"]>("all");
  const [showBidModal, setShowBidModal] = useState(false);

  useEffect(() => {
    let ignore = false;

    const loadJob = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await jobsService.getJobById(id);
        if (!ignore) {
          setJob(data);
          setForm(toEditForm(data));
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Unable to load job.");
          setJob(null);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    loadJob();

    return () => {
      ignore = true;
    };
  }, [id]);

  const isOwner = useMemo(() => {
    if (!job || !user) return false;
    return user.role === "homeowner" && user.id === job.postedBy.id;
  }, [job, user]);

  const verificationStatus = user?.verification ?? "pending";
  const isVerifiedHandyman =
    user?.role !== "handyman" || verificationStatus === "approved";
  const canEdit = !!job && isOwner;
  const canSubmitBid =
    !!job &&
    job.status === "open" &&
    user?.role === "handyman" &&
    user.id !== job.postedBy.id &&
    isVerifiedHandyman;
  const canReportHomeowner =
    !!job &&
    user?.role === "handyman" &&
    user.id !== job.postedBy.id;
  const showUnverifiedBidWarning =
    !!job &&
    user?.role === "handyman" &&
    user.id !== job.postedBy.id &&
    !isVerifiedHandyman;

  useEffect(() => {
    if (!job || !isOwner) {
      setBids([]);
      setBidsError(null);
      return;
    }

    let ignore = false;

    const loadBids = async () => {
      setBidsLoading(true);
      setBidsError(null);
      try {
        const response = await bidsService.getBidsForJob(job.id, { page: 1, pageSize: 100 });
        if (!ignore) setBids(response.bids ?? []);
      } catch (err) {
        if (!ignore) {
          setBids([]);
          setBidsError(err instanceof Error ? err.message : "Unable to load bids.");
        }
      } finally {
        if (!ignore) setBidsLoading(false);
      }
    };

    void loadBids();

    return () => {
      ignore = true;
    };
  }, [job, isOwner]);

  const hasChanges = useMemo(() => {
    if (!job || !form) return false;

    return (
      form.title.trim() !== job.title ||
      form.description.trim() !== job.description ||
      form.category !== job.category ||
      form.location.trim() !== job.location ||
      form.budget.trim() !== (typeof job.budget === "number" ? String(job.budget) : "") ||
      form.isEmergency !== job.isEmergency
    );
  }, [form, job]);

  const visibleBids = useMemo(() => {
    if (bidStatusFilter === "all") return bids;
    return bids.filter((bid) => bid.status === bidStatusFilter);
  }, [bids, bidStatusFilter]);

  const handleSave = async () => {
    if (!job || !form || !hasChanges) return;

    setSaving(true);
    setError(null);

    try {
      const updated = await jobsService.updateJob(job.id, {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        location: form.location.trim(),
        budget: form.budget.trim() ? Number(form.budget) : undefined,
        isEmergency: form.isEmergency,
      });
      setJob(updated);
      setForm(toEditForm(updated));
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update job.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!job) return;

    const confirmed = window.confirm("Delete this job? This action cannot be undone.");
    if (!confirmed) return;

    setDeleting(true);
    setError(null);

    try {
      await jobsService.deleteJob(job.id);
      router.push("/my-jobs");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete job.");
      setDeleting(false);
    }
  };

  const handleAcceptBid = async (bidId: string) => {
    setBidActionLoadingId(bidId);
    setBidsError(null);
    try {
      const accepted = await bidsService.acceptBid(bidId);
      setBids((prev) => prev.map((bid) => (bid.id === bidId ? accepted : bid)));
      setJob((prev) => (prev ? { ...prev, status: "in-progress" } : prev));
    } catch (err) {
      setBidsError(err instanceof Error ? err.message : "Unable to accept bid.");
    } finally {
      setBidActionLoadingId(null);
    }
  };

  const handleRejectBid = async (bidId: string) => {
    setBidActionLoadingId(bidId);
    setBidsError(null);
    try {
      const rejected = await bidsService.rejectBid(bidId);
      setBids((prev) => prev.map((bid) => (bid.id === bidId ? rejected : bid)));
    } catch (err) {
      setBidsError(err instanceof Error ? err.message : "Unable to reject bid.");
    } finally {
      setBidActionLoadingId(null);
    }
  };

  const handleMessageBid = useCallback((bidId: string) => {
    if (!job) return;

    const target = bids.find((bid) => bid.id === bidId);
    if (!target) return;

    openForBidChat({
      jobId: job.id,
      bidId: target.id,
      otherUserId: target.handyman.id,
      otherUserName: target.handyman.name,
    });
  }, [bids, job, openForBidChat]);

  const handleReportUser = useCallback((targetUserId: string, targetUserName: string) => {
    const query = new URLSearchParams({
      targetUserId,
      targetName: targetUserName,
    });

    router.push(`/reports?${query.toString()}`);
  }, [router]);

  const handleReportBidUser = useCallback((bidId: string) => {
    const target = bids.find((bid) => bid.id === bidId);
    if (!target) return;

    handleReportUser(target.handyman.id, target.handyman.name);
  }, [bids, handleReportUser]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-sm text-[#6B7280]">Loading job...</p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/my-jobs"
            className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#111827] mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
            <p className="text-sm text-red-700">{error ?? "Job not found."}</p>
          </div>
        </div>
      </div>
    );
  }

  const backHref = user?.role === "handyman" ? "/handyman" : "/my-jobs";

  return (
    <div className="min-h-screen bg-[#F7F8FA] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-5">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#111827]"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {showUnverifiedBidWarning && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {verificationStatus === "rejected"
                  ? "Your handyman verification was rejected. You can view this job, but bid submission is disabled. Please contact support or an admin."
                  : "Your handyman account is pending verification. You can view this job, but bid submission is disabled until your verification is approved."}
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={job.status} />
              {job.isEmergency && <StatusBadge status="emergency" />}
              <span className="px-2 py-0.5 bg-[#F7F8FA] rounded-full text-xs font-medium text-[#374151]">
                {job.category}
              </span>
            </div>

            {(canEdit || canReportHomeowner) && !editing && (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                {canReportHomeowner && (
                  <button
                    onClick={() => handleReportUser(job.postedBy.id, job.postedBy.name)}
                    className="inline-flex items-center gap-1.5 self-start rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:border-red-300 hover:bg-red-100 sm:self-auto"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Report homeowner
                  </button>
                )}

                {canEdit && (
                  <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
                    <PrimaryButton size="sm" variant="secondary" onClick={() => setEditing(true)}>
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </PrimaryButton>
                    <PrimaryButton
                      size="sm"
                      variant="outline"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="text-red-600 border-red-300 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> {deleting ? "Deleting..." : "Delete"}
                    </PrimaryButton>
                  </div>
                )}
              </div>
            )}
          </div>

          {!editing ? (
            <>
              <h1 className="text-2xl font-bold text-[#111827] mb-3">{job.title}</h1>

              <div className="flex items-center gap-4 text-sm text-[#6B7280] flex-wrap mb-4">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" /> {job.location}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {new Date(job.createdAt).toLocaleDateString("en-MY", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4" /> Budget: RM {job.budget ?? "-"}
                </span>
              </div>

              <p className="text-sm text-[#374151] leading-relaxed whitespace-pre-wrap">{job.description}</p>

              {job.imageUrls.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-sm font-medium text-[#111827]">Job Photos</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {job.imageUrls.map((url, index) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#F7F8FA]"
                      >
                        <img
                          src={url}
                          alt={`${job.title} photo ${index + 1}`}
                          className="h-52 w-full object-cover"
                          loading="lazy"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {canSubmitBid && (
                <div className="mt-6 flex justify-end">
                  <PrimaryButton size="sm" onClick={() => setShowBidModal(true)}>
                    Submit Bid
                  </PrimaryButton>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1.5">Title</label>
                <input
                  value={form?.title ?? ""}
                  onChange={(e) =>
                    setForm((prev) => (prev ? { ...prev, title: e.target.value } : prev))
                  }
                  className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1.5">Description</label>
                <textarea
                  rows={5}
                  value={form?.description ?? ""}
                  onChange={(e) =>
                    setForm((prev) => (prev ? { ...prev, description: e.target.value } : prev))
                  }
                  className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF] resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#111827] mb-1.5">Category</label>
                  <select
                    value={form?.category ?? "Plumbing"}
                    onChange={(e) =>
                      setForm((prev) =>
                        prev ? { ...prev, category: e.target.value as JobCategory } : prev
                      )
                    }
                    className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF]"
                  >
                    {ALL_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#111827] mb-1.5">Budget (RM)</label>
                  <input
                    type="number"
                    min={0}
                    value={form?.budget ?? ""}
                    onChange={(e) =>
                      setForm((prev) => (prev ? { ...prev, budget: e.target.value } : prev))
                    }
                    className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1.5">Location</label>
                <input
                  value={form?.location ?? ""}
                  onChange={(e) =>
                    setForm((prev) => (prev ? { ...prev, location: e.target.value } : prev))
                  }
                  className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF]"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-[#111827]">
                <input
                  type="checkbox"
                  checked={form?.isEmergency ?? false}
                  onChange={(e) =>
                    setForm((prev) => (prev ? { ...prev, isEmergency: e.target.checked } : prev))
                  }
                />
                Emergency job
              </label>

              <div className="flex items-center gap-2 pt-1">
                <PrimaryButton onClick={handleSave} disabled={!hasChanges || saving}>
                  <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save"}
                </PrimaryButton>
                <PrimaryButton
                  variant="secondary"
                  onClick={() => {
                    setForm(toEditForm(job));
                    setEditing(false);
                  }}
                  disabled={saving}
                >
                  <X className="w-4 h-4" /> Cancel
                </PrimaryButton>
              </div>
            </div>
          )}
        </div>

        {isOwner && (
          <section className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
            <h2 className="text-lg font-bold text-[#111827] mb-4">Bids ({bids.length})</h2>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              {(["all", "pending", "accepted", "rejected"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setBidStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                    bidStatusFilter === status
                      ? "bg-[#0B74FF] text-white border-[#0B74FF]"
                      : "bg-white text-[#374151] border-[#E5E7EB] hover:border-blue-300"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            {bidsError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {bidsError}
              </div>
            )}

            {bidsLoading ? (
              <p className="text-sm text-[#6B7280]">Loading bids...</p>
            ) : visibleBids.length === 0 ? (
              <p className="text-sm text-[#6B7280]">No bids have been submitted yet.</p>
            ) : (
              <div className="space-y-4">
                {visibleBids.map((bid) => (
                  <div key={bid.id} className="space-y-2">
                    <BidCard
                      bid={bid}
                      onAccept={handleAcceptBid}
                      onMessage={handleMessageBid}
                      onReport={handleReportBidUser}
                    />
                    {bid.status === "pending" && (
                      <div className="flex justify-end">
                        <button
                          onClick={() => void handleRejectBid(bid.id)}
                          disabled={bidActionLoadingId === bid.id}
                          className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50 disabled:opacity-50"
                        >
                          {bidActionLoadingId === bid.id ? "Updating..." : "Reject Bid"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {showBidModal && (
        <SubmitBidModal
          jobId={job.id}
          onClose={() => setShowBidModal(false)}
          onSuccess={() => {
            setShowBidModal(false);
            setJob((prev) => (prev ? { ...prev, bidCount: prev.bidCount + 1 } : prev));
          }}
        />
      )}
    </div>
  );
}
