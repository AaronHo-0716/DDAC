"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, DollarSign, MapPin, Pencil, Save, Trash2, X } from "lucide-react";
import type { Job, JobCategory } from "@/app/types";
import { jobsService } from "@/app/lib/api/jobs";
import { useAuth } from "@/app/lib/context/AuthContext";
import PrimaryButton from "@/app/components/ui/PrimaryButton";
import StatusBadge from "@/app/components/ui/StatusBadge";

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

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);

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

  const canEdit = !!job && isOwner;

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

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={job.status} />
              {job.isEmergency && <StatusBadge status="emergency" />}
              <span className="px-2 py-0.5 bg-[#F7F8FA] rounded-full text-xs font-medium text-[#374151]">
                {job.category}
              </span>
            </div>

            {canEdit && !editing && (
              <div className="flex items-center gap-2">
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
      </div>
    </div>
  );
}
