"use client";

import { AlertTriangle, X } from "lucide-react";
import PrimaryButton from "./PrimaryButton";

interface ModalConfirmProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ModalConfirm({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ModalConfirmProps) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/35 z-40" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-[#E5E7EB] rounded-2xl shadow-xl">
          <div className="flex items-start justify-between p-5 border-b border-[#E5E7EB]">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#111827]">{title}</h3>
                <p className="text-sm text-[#6B7280] mt-1">{description}</p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="w-8 h-8 rounded-lg text-[#6B7280] hover:bg-[#F7F8FA] flex items-center justify-center"
              aria-label="Close confirmation modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-5 flex justify-end gap-3">
            <PrimaryButton variant="secondary" onClick={onCancel}>
              {cancelLabel}
            </PrimaryButton>
            <PrimaryButton
              onClick={onConfirm}
              className={destructive ? "bg-red-600 hover:bg-red-700" : ""}
            >
              {confirmLabel}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </>
  );
}
