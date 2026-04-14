"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, ChevronLeft, AlertCircle } from "lucide-react";
import PrimaryButton from "../components/ui/PrimaryButton";
import ImageUploader from "../components/ui/ImageUploader";
import type { JobCategory } from "../types";
import { useRequireRole } from "../lib/hooks/useRequireRole";
import { jobsService } from "../lib/api/jobs";
import { uploadsService } from "../lib/api/uploads";

const CATEGORIES: { name: JobCategory; emoji: string; desc: string }[] = [
  {
    name: "Plumbing",
    emoji: "🔧",
    desc: "Pipes, faucets, drains, water heaters",
  },
  {
    name: "Electrical",
    emoji: "⚡",
    desc: "Wiring, outlets, switches, fuse box",
  },
  {
    name: "Carpentry",
    emoji: "🪚",
    desc: "Doors, cabinets, shelves, furniture",
  },
  {
    name: "Appliance Repair",
    emoji: "🔌",
    desc: "Washer, dryer, AC, refrigerator",
  },
  {
    name: "General Maintenance",
    emoji: "🏠",
    desc: "Painting, cleaning, odd jobs",
  },
];

const STEPS = ["Category", "Details", "Photos", "Review"];

interface FormState {
  category: JobCategory | "";
  title: string;
  description: string;
  location: string;
  budget: string;
  isEmergency: boolean;
}

const EMPTY_FORM: FormState = {
  category: "",
  title: "",
  description: "",
  location: "",
  budget: "",
  isEmergency: false,
};

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="flex items-start mb-8">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-start flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                i < step
                  ? "bg-[#0B74FF] text-white"
                  : i === step
                    ? "bg-[#0B74FF] text-white ring-4 ring-blue-100"
                    : "bg-[#E5E7EB] text-[#9CA3AF]"
              }`}>
              {i < step ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span
              className={`text-xs mt-1 font-medium whitespace-nowrap ${
                i <= step ? "text-[#0B74FF]" : "text-[#9CA3AF]"
              }`}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-2 mt-4 transition-colors ${
                i < step ? "bg-[#0B74FF]" : "bg-[#E5E7EB]"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function CreateJobPage() {
  const router = useRouter();
  const { authorized, loading } = useRequireRole("homeowner");
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const canAdvance = [
    form.category !== "",
    !!(form.title.trim() && form.description.trim() && form.location.trim()),
    true,
    true,
  ][step];

  if (loading || !authorized) {
    return null;
  }

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const uploadedImageUrls =
        photos.length > 0
          ? (
              await Promise.all(
                photos.map((photo) => uploadsService.uploadJobImage(photo)),
              )
            ).map((upload) => upload.url)
          : [];

      await jobsService.createJob({
        title: form.title,
        description: form.description,
        category: form.category as JobCategory,
        location: form.location,
        budget: form.budget ? Number(form.budget) : undefined,
        isEmergency: form.isEmergency,
        imageUrls: uploadedImageUrls,
      });

      setSubmitting(false);
      setSubmitted(true);
    } catch (error) {
      setSubmitting(false);
      setSubmitError(
        `Failed to post job: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-[#111827] mb-2">Job Posted!</h2>
          <p className="text-[#6B7280] text-sm mb-6">
            Your job is live. Handymen in your area will start sending bids
            shortly.
          </p>
          <div className="flex gap-3">
            <PrimaryButton
              variant="secondary"
              fullWidth
              onClick={() => router.push("/dashboard")}>
              Back to Dashboard
            </PrimaryButton>
            <PrimaryButton
              fullWidth
              onClick={() => {
                setSubmitted(false);
                setStep(0);
                setForm(EMPTY_FORM);
              }}>
              Post Another
            </PrimaryButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] py-10 px-4 sm:px-6">
      <div className="max-w-xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#111827]">Post a Job</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Describe your repair and get competitive bids from local handymen
          </p>
        </div>

        <ProgressBar step={step} />

        {/* Step card */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 mb-6">
          {/* ── Step 0: Category ── */}
          {step === 0 && (
            <div>
              <h2 className="text-lg font-semibold text-[#111827] mb-1">
                What type of repair?
              </h2>
              <p className="text-sm text-[#6B7280] mb-4">
                Select the category that best fits your job
              </p>
              <div className="space-y-3">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => setForm({ ...form, category: cat.name })}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                      form.category === cat.name
                        ? "border-[#0B74FF] bg-blue-50"
                        : "border-[#E5E7EB] hover:border-blue-200 hover:bg-[#F7F8FA]"
                    }`}>
                    <span className="text-2xl">{cat.emoji}</span>
                    <div className="flex-1">
                      <p
                        className={`font-medium ${
                          form.category === cat.name
                            ? "text-[#0B74FF]"
                            : "text-[#111827]"
                        }`}>
                        {cat.name}
                      </p>
                      <p className="text-xs text-[#6B7280]">{cat.desc}</p>
                    </div>
                    {form.category === cat.name && (
                      <Check className="w-5 h-5 text-[#0B74FF]" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 1: Details ── */}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-semibold text-[#111827] mb-1">
                Job Details
              </h2>
              <p className="text-sm text-[#6B7280] mb-5">
                Help handymen understand exactly what you need
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#111827] mb-1.5">
                    Job Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Fix leaky kitchen faucet"
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-[#E5E7EB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#111827] mb-1.5">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Describe the issue in detail. The more specific, the better the bids."
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-[#E5E7EB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF] focus:border-transparent resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#111827] mb-1.5">
                    Location <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Kuala Lumpur, Malaysia"
                    value={form.location}
                    onChange={(e) =>
                      setForm({ ...form, location: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-[#E5E7EB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#111827] mb-1.5">
                    Budget (optional)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B7280] font-medium">
                      RM
                    </span>
                    <input
                      type="number"
                      min={0}
                      placeholder="150"
                      value={form.budget}
                      onChange={(e) =>
                        setForm({ ...form, budget: e.target.value })
                      }
                      className="w-full pl-12 pr-4 py-2.5 border border-[#E5E7EB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF] focus:border-transparent"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setForm({ ...form, isEmergency: !form.isEmergency })
                  }
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                    form.isEmergency
                      ? "border-red-400 bg-red-50"
                      : "border-[#E5E7EB] hover:border-red-200"
                  }`}>
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      form.isEmergency
                        ? "bg-red-500 border-red-500"
                        : "border-[#D1D5DB]"
                    }`}>
                    {form.isEmergency && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <div>
                    <p
                      className={`text-sm font-medium flex items-center gap-1.5 ${
                        form.isEmergency ? "text-red-600" : "text-[#111827]"
                      }`}>
                      <AlertCircle className="w-4 h-4" />
                      Emergency job
                    </p>
                    <p className="text-xs text-[#6B7280]">
                      Needs to be fixed today — gets priority visibility
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Photos ── */}
          {step === 2 && (
            <div>
              <h2 className="text-lg font-semibold text-[#111827] mb-1">
                Upload Photos
              </h2>
              <p className="text-sm text-[#6B7280] mb-5">
                Photos help handymen give more accurate quotes (optional)
              </p>
              <ImageUploader files={photos} onChange={setPhotos} maxFiles={5} />
              <p className="text-xs text-[#9CA3AF] mt-3 text-center">
                Selected files will be uploaded to S3 via the backend when you
                submit the job.
              </p>
            </div>
          )}

          {/* ── Step 3: Review ── */}
          {step === 3 && (
            <div>
              <h2 className="text-lg font-semibold text-[#111827] mb-1">
                Review & Submit
              </h2>
              <p className="text-sm text-[#6B7280] mb-5">
                Check the details before your job goes live
              </p>
              <div className="divide-y divide-[#F3F4F6]">
                {[
                  { label: "Category", value: form.category },
                  { label: "Title", value: form.title },
                  { label: "Description", value: form.description },
                  { label: "Location", value: form.location },
                  {
                    label: "Budget",
                    value: form.budget ? `RM ${form.budget}` : "Not specified",
                  },
                  {
                    label: "Emergency",
                    value: form.isEmergency ? "🚨 Yes" : "No",
                  },
                  {
                    label: "Photos",
                    value:
                      photos.length > 0 ? `${photos.length} selected` : "None",
                  },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex flex-col sm:flex-row sm:items-start gap-1 py-3">
                    <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide sm:w-28 flex-shrink-0 mt-0.5">
                      {label}
                    </span>
                    <span className="text-sm text-[#111827] break-words">
                      {value || "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {submitError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between">
          {step > 0 ? (
            <PrimaryButton
              variant="secondary"
              onClick={() => setStep(step - 1)}>
              <ChevronLeft className="w-4 h-4" /> Back
            </PrimaryButton>
          ) : (
            <div />
          )}

          {step < STEPS.length - 1 ? (
            <PrimaryButton
              disabled={!canAdvance}
              onClick={() => setStep(step + 1)}>
              Continue <ChevronRight className="w-4 h-4" />
            </PrimaryButton>
          ) : (
            <PrimaryButton disabled={submitting} onClick={handleSubmit}>
              {submitting ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none">
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
                  {photos.length > 0 ? "Uploading & Posting…" : "Posting…"}
                </span>
              ) : (
                <>Post Job</>
              )}
            </PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
}
