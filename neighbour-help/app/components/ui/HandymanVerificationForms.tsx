"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CreditCard, Upload, X } from "lucide-react";
import PrimaryButton from "./PrimaryButton";

interface HandymanVerificationFormsProps {
  mode: "signup" | "reverify";
  onFilesChange?: (hasRequiredFiles: boolean) => void;
  onFilesSelected?: (files: { selfieFile: File | null; idCardFile: File | null }) => void;
  onSubmitVerification?: (files: { selfieFile: File; idCardFile: File }) => Promise<void>;
  submitting?: boolean;
}

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

function validateImage(file: File): string | null {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File too large. Max size is ${MAX_FILE_SIZE_MB}MB.`;
  }

  if (!file.type || !ACCEPTED_TYPES.includes(file.type.toLowerCase())) {
    return "Unsupported format. Please upload JPG, PNG, WEBP, or HEIC images.";
  }

  return null;
}

function FileField({
  label,
  hint,
  file,
  onSelect,
  onClear,
  inputRef,
  icon,
}: {
  label: string;
  hint: string;
  file: File | null;
  onSelect: (file: File | null) => void;
  onClear: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[#111827]">
        {icon}
        {label}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#111827] hover:bg-[#F7F8FA]"
      >
        <Upload className="w-4 h-4" /> Choose File
      </button>

      {file && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm text-[#111827]">{file.name}</p>
            <p className="text-xs text-[#6B7280]">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="ml-3 flex h-7 w-7 items-center justify-center rounded-md text-[#6B7280] hover:bg-[#F3F4F6]"
            aria-label="Remove selected file"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <p className="mt-2 text-xs text-[#6B7280]">{hint}</p>
    </div>
  );
}

export default function HandymanVerificationForms({
  mode,
  onFilesChange,
  onFilesSelected,
  onSubmitVerification,
  submitting = false,
}: HandymanVerificationFormsProps) {
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selfieInputRef = useRef<HTMLInputElement | null>(null);
  const idCardInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    onFilesChange?.(!!selfieFile && !!idCardFile);
  }, [selfieFile, idCardFile, onFilesChange]);

  useEffect(() => {
    onFilesSelected?.({ selfieFile, idCardFile });
  }, [selfieFile, idCardFile, onFilesSelected]);

  const handlePick = (
    file: File | null,
    assign: (file: File | null) => void,
    inputRef: React.RefObject<HTMLInputElement | null>
  ) => {
    setMessage(null);

    if (!file) {
      assign(null);
      return;
    }

    const validationError = validateImage(file);
    if (validationError) {
      setError(validationError);
      assign(null);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      return;
    }

    setError(null);
    assign(file);
  };

  const clearFile = (
    assign: (file: File | null) => void,
    inputRef: React.RefObject<HTMLInputElement | null>
  ) => {
    assign(null);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleSubmitVerification = async () => {
    if (!selfieFile || !idCardFile) return;

    if (!onSubmitVerification) {
      setMessage("Verification submission is not available right now.");
      return;
    }

    setError(null);
    setMessage(null);

    try {
      await onSubmitVerification({ selfieFile, idCardFile });
      setMessage(
        mode === "reverify"
          ? "Reverification submitted successfully."
          : "Verification submitted successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit verification right now."
      );
    }
  };

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-[#111827]">
          {mode === "reverify" ? "Reverification Documents" : "Handyman Verification Documents"}
        </h3>
        <p className="mt-1 text-sm text-[#6B7280]">
          Upload a clear selfie and your identification card for account verification review.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {message && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FileField
          label="Selfie"
          hint="Front-facing photo with good lighting."
          file={selfieFile}
          onSelect={(file) => handlePick(file, setSelfieFile, selfieInputRef)}
          onClear={() => clearFile(setSelfieFile, selfieInputRef)}
          inputRef={selfieInputRef}
          icon={<Camera className="w-4 h-4 text-[#0B74FF]" />}
        />

        <FileField
          label="Identification Card"
          hint="MyKad/passport image, all text clearly visible."
          file={idCardFile}
          onSelect={(file) => handlePick(file, setIdCardFile, idCardInputRef)}
          onClear={() => clearFile(setIdCardFile, idCardInputRef)}
          inputRef={idCardInputRef}
          icon={<CreditCard className="w-4 h-4 text-[#0B74FF]" />}
        />
      </div>

      {mode === "reverify" && (
        <div className="pt-1">
          <PrimaryButton
            type="button"
            variant="secondary"
            disabled={!selfieFile || !idCardFile || submitting}
            onClick={() => void handleSubmitVerification()}
          >
            {submitting ? "Submitting..." : "Submit Reverification"}
          </PrimaryButton>
        </div>
      )}
    </div>
  );
}
