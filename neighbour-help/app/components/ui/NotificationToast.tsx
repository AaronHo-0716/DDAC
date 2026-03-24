"use client";

import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

interface NotificationToastProps {
  title: string;
  message?: string;
  variant?: ToastVariant;
  onClose?: () => void;
}

const variantStyle: Record<
  ToastVariant,
  { icon: React.ReactNode; border: string; iconColor: string }
> = {
  success: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    border: "border-green-200",
    iconColor: "text-green-600",
  },
  error: {
    icon: <AlertTriangle className="w-4 h-4" />,
    border: "border-red-200",
    iconColor: "text-red-600",
  },
  info: {
    icon: <Info className="w-4 h-4" />,
    border: "border-blue-200",
    iconColor: "text-[#0B74FF]",
  },
};

export default function NotificationToast({
  title,
  message,
  variant = "info",
  onClose,
}: NotificationToastProps) {
  const style = variantStyle[variant];

  return (
    <div className={`bg-white ${style.border} border rounded-xl shadow-lg p-4 w-full max-w-sm`} role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${style.iconColor}`}>{style.icon}</div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#111827]">{title}</p>
          {message && <p className="text-xs text-[#6B7280] mt-1">{message}</p>}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-[#F7F8FA] text-[#6B7280] flex items-center justify-center"
            aria-label="Close notification"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
