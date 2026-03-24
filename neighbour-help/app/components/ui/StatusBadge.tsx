interface StatusBadgeProps {
  status:
    | "open"
    | "in-progress"
    | "completed"
    | "emergency"
    | "recommended"
    | "pending"
    | "accepted"
    | "rejected";
  className?: string;
}

const config: Record<StatusBadgeProps["status"], { label: string; styles: string }> = {
  open: {
    label: "Open",
    styles: "bg-green-50 text-green-700 border border-green-200",
  },
  "in-progress": {
    label: "In Progress",
    styles: "bg-blue-50 text-blue-700 border border-blue-200",
  },
  completed: {
    label: "Completed",
    styles: "bg-gray-100 text-gray-600 border border-gray-200",
  },
  emergency: {
    label: "Emergency",
    styles: "bg-red-50 text-red-700 border border-red-200",
  },
  recommended: {
    label: "Recommended",
    styles: "bg-amber-50 text-amber-700 border border-amber-200",
  },
  pending: {
    label: "Pending",
    styles: "bg-amber-50 text-amber-700 border border-amber-200",
  },
  accepted: {
    label: "Accepted",
    styles: "bg-green-50 text-green-700 border border-green-200",
  },
  rejected: {
    label: "Rejected",
    styles: "bg-red-50 text-red-700 border border-red-200",
  },
};

export default function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const { label, styles } = config[status];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles} ${className}`}
    >
      {label}
    </span>
  );
}
