"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Ban, CheckCircle2, UserCheck, UserX } from "lucide-react";
import { useRequireRole } from "@/app/lib/hooks/useRequireRole";
import type { UserRole } from "@/app/types";

type VerificationStatus = "pending" | "approved" | "rejected";

type UserStatus = "active" | "blocked";

interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  verificationStatus?: VerificationStatus;
  blockReason?: string;
  createdAt: string;
}

const SEED_USERS: AdminUserItem[] = [
  {
    id: "u-homeowner-1",
    name: "Alice Tan",
    email: "alice@example.com",
    role: "homeowner",
    status: "active",
    createdAt: "2026-02-01T08:00:00Z",
  },
  {
    id: "u-handyman-1",
    name: "Demo Handyman",
    email: "handyman@neighborhelp.test",
    role: "handyman",
    status: "active",
    verificationStatus: "approved",
    createdAt: "2026-02-10T10:10:00Z",
  },
  {
    id: "u-handyman-2",
    name: "Raj Kumar",
    email: "raj@example.com",
    role: "handyman",
    status: "active",
    verificationStatus: "pending",
    createdAt: "2026-03-01T09:20:00Z",
  },
  {
    id: "u-homeowner-2",
    name: "Noisy User",
    email: "noisy@example.com",
    role: "homeowner",
    status: "blocked",
    blockReason: "Repeated abuse reports",
    createdAt: "2026-01-20T11:40:00Z",
  },
];

function statusPill(status: UserStatus) {
  return status === "active" ? (
    <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
      active
    </span>
  ) : (
    <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
      blocked
    </span>
  );
}

function verificationPill(status?: VerificationStatus) {
  if (!status) return <span className="text-xs text-[#9CA3AF]">-</span>;

  const styleMap: Record<VerificationStatus, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-green-50 text-green-700 border-green-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styleMap[status]}`}>
      {status}
    </span>
  );
}

export default function AdminUsersPage() {
  const { authorized, loading } = useRequireRole("admin");
  const [rows, setRows] = useState<AdminUserItem[]>(SEED_USERS);
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | UserStatus>("all");

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (roleFilter !== "all" && row.role !== roleFilter) return false;
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      return true;
    });
  }, [rows, roleFilter, statusFilter]);

  if (loading || !authorized) {
    return null;
  }

  const blockUser = (id: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? { ...row, status: "blocked", blockReason: "Blocked by admin moderation" }
          : row
      )
    );
  };

  const unblockUser = (id: string) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, status: "active", blockReason: undefined } : row))
    );
  };

  const updateVerification = (id: string, status: VerificationStatus) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id && row.role === "handyman"
          ? { ...row, verificationStatus: status }
          : row
      )
    );
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">User Administration</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              Block/unblock users and manage handyman verification status.
            </p>
          </div>
          <Link href="/admin" className="text-sm font-semibold text-[#0B74FF] hover:underline">
            Back to Admin Dashboard
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 mb-5 flex items-center gap-2 flex-wrap">
          {(["all", "homeowner", "handyman", "admin"] as const).map((role) => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                roleFilter === role
                  ? "bg-[#0B74FF] text-white border-[#0B74FF]"
                  : "bg-white text-[#374151] border-[#E5E7EB] hover:border-blue-300"
              }`}
            >
              {role}
            </button>
          ))}

          {(["all", "active", "blocked"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                statusFilter === status
                  ? "bg-[#111827] text-white border-[#111827]"
                  : "bg-white text-[#374151] border-[#E5E7EB]"
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F9FAFB] text-xs uppercase tracking-wide text-[#6B7280]">
                <tr>
                  <th className="text-left px-4 py-3">User</th>
                  <th className="text-left px-4 py-3">Role</th>
                  <th className="text-left px-4 py-3">Account</th>
                  <th className="text-left px-4 py-3">Verification</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#111827]">{row.name}</p>
                      <p className="text-xs text-[#6B7280]">{row.email}</p>
                      {row.blockReason && (
                        <p className="text-xs text-red-600 mt-1">Reason: {row.blockReason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold uppercase text-[#374151]">{row.role}</td>
                    <td className="px-4 py-3">{statusPill(row.status)}</td>
                    <td className="px-4 py-3">{verificationPill(row.verificationStatus)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {row.status === "active" ? (
                          <button
                            onClick={() => blockUser(row.id)}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 inline-flex items-center gap-1"
                          >
                            <UserX className="w-3.5 h-3.5" /> Block
                          </button>
                        ) : (
                          <button
                            onClick={() => unblockUser(row.id)}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 inline-flex items-center gap-1"
                          >
                            <UserCheck className="w-3.5 h-3.5" /> Unblock
                          </button>
                        )}

                        {row.role === "handyman" && (
                          <>
                            <button
                              onClick={() => updateVerification(row.id, "approved")}
                              className="text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 inline-flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                            </button>
                            <button
                              onClick={() => updateVerification(row.id, "rejected")}
                              className="text-xs px-2.5 py-1.5 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 inline-flex items-center gap-1"
                            >
                              <Ban className="w-3.5 h-3.5" /> Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div className="p-8 text-center text-sm text-[#6B7280]">No users in this filter.</div>
          )}
        </div>
      </div>
    </div>
  );
}
