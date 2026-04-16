"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Ban, CheckCircle2, Eye, UserCheck, UserPlus, UserX, X } from "lucide-react";
import { useRequireRole } from "@/app/lib/hooks/useRequireRole";
import {
  adminService,
  type AdminHandymanVerification,
  type AdminUserItem,
  type UserStatus,
  type VerificationStatus,
} from "@/app/lib/api/admin";
import type { UserRole } from "@/app/types";

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
  const [rows, setRows] = useState<AdminUserItem[]>([]);
  const [pendingVerifications, setPendingVerifications] = useState<
    AdminHandymanVerification[]
  >([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [selectedHandymanId, setSelectedHandymanId] = useState<string | null>(
    null
  );
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | UserStatus>("all");
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [createAdminError, setCreateAdminError] = useState<string | null>(null);
  const [createAdminSuccess, setCreateAdminSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!authorized) return;

    let cancelled = false;

    const load = async () => {
      setFetching(true);
      setError(null);
      try {
        const [users, pending] = await Promise.all([
          adminService.getUsers(),
          adminService.getPendingVerificationRecords(),
        ]);
        if (!cancelled) {
          setRows(users);
          setPendingVerifications(pending);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load users.");
        }
      } finally {
        if (!cancelled) setFetching(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [authorized]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (roleFilter !== "all" && row.role !== roleFilter) return false;
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      return true;
    });
  }, [rows, roleFilter, statusFilter]);

  const selectedHandyman = useMemo(
    () => rows.find((row) => row.id === selectedHandymanId),
    [rows, selectedHandymanId]
  );

  const selectedVerification = useMemo(
    () =>
      pendingVerifications.find(
        (record) =>
          record.userId === selectedHandymanId && record.status === "pending"
      ),
    [pendingVerifications, selectedHandymanId]
  );

  if (loading || !authorized) {
    return null;
  }

  const blockUser = async (id: string) => {
    setPendingActionId(id);
    setError(null);
    try {
      await adminService.blockUser(id);
      setRows((prev) =>
        prev.map((row) =>
          row.id === id
            ? { ...row, status: "blocked", blockReason: "Blocked by admin moderation" }
            : row
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to block user.");
    } finally {
      setPendingActionId(null);
    }
  };

  const unblockUser = async (id: string) => {
    setPendingActionId(id);
    setError(null);
    try {
      await adminService.unblockUser(id);
      setRows((prev) =>
        prev.map((row) =>
          row.id === id ? { ...row, status: "active", blockReason: undefined } : row
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unblock user.");
    } finally {
      setPendingActionId(null);
    }
  };

  const updateVerification = async (id: string, status: VerificationStatus) => {
    setPendingActionId(id);
    setError(null);
    try {
      await adminService.updateVerification(id, status);
      setRows((prev) =>
        prev.map((row) =>
          row.id === id && row.role === "handyman" ? { ...row, verificationStatus: status } : row
        )
      );
      if (status !== "pending") {
        setPendingVerifications((prev) => prev.filter((record) => record.userId !== id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update verification.");
    } finally {
      setPendingActionId(null);
    }
  };

  const openHandymanProfile = (id: string) => {
    setSelectedHandymanId(id);
  };

  const closeHandymanProfile = () => {
    setSelectedHandymanId(null);
  };

  const handleModalVerification = async (status: VerificationStatus) => {
    if (!selectedHandyman?.id) return;
    await updateVerification(selectedHandyman.id, status);
    closeHandymanProfile();
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();

    const name = newAdminName.trim();
    const email = newAdminEmail.trim().toLowerCase();
    const password = newAdminPassword;

    if (!name || !email || !password) {
      setCreateAdminError("Name, email, and password are required.");
      setCreateAdminSuccess(null);
      return;
    }

    setCreatingAdmin(true);
    setCreateAdminError(null);
    setCreateAdminSuccess(null);

    try {
      await adminService.createAdmin(name, email, password);
      const users = await adminService.getUsers();
      setRows(users);
      setNewAdminName("");
      setNewAdminEmail("");
      setNewAdminPassword("");
      setCreateAdminSuccess(`Admin account for ${email} created successfully.`);
    } catch (err) {
      setCreateAdminError(err instanceof Error ? err.message : "Failed to create admin account.");
    } finally {
      setCreatingAdmin(false);
    }
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

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mb-5 rounded-2xl border border-[#E5E7EB] bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-[#0B74FF]" />
            <h2 className="text-sm font-semibold text-[#111827]">Add New Admin</h2>
          </div>

          {createAdminError && (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
              {createAdminError}
            </div>
          )}

          {createAdminSuccess && (
            <div className="mb-3 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-700">
              {createAdminSuccess}
            </div>
          )}

          <form onSubmit={handleCreateAdmin} className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <input
              value={newAdminName}
              onChange={(e) => setNewAdminName(e.target.value)}
              placeholder="Account name"
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF]"
            />
            <input
              type="email"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              placeholder="Email address"
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF]"
            />
            <input
              type="password"
              value={newAdminPassword}
              onChange={(e) => setNewAdminPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF]"
            />
            <button
              type="submit"
              disabled={creatingAdmin}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B74FF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#065ed1] disabled:opacity-60"
            >
              <UserPlus className="h-4 w-4" />
              {creatingAdmin ? "Creating..." : "Create Admin"}
            </button>
          </form>
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
                            onClick={() => void blockUser(row.id)}
                            disabled={pendingActionId === row.id}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 inline-flex items-center gap-1"
                          >
                            <UserX className="w-3.5 h-3.5" /> Block
                          </button>
                        ) : (
                          <button
                            onClick={() => void unblockUser(row.id)}
                            disabled={pendingActionId === row.id}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 inline-flex items-center gap-1"
                          >
                            <UserCheck className="w-3.5 h-3.5" /> Unblock
                          </button>
                        )}

                        {row.role === "handyman" && (
                          <button
                            onClick={() => openHandymanProfile(row.id)}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 inline-flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {row.verificationStatus === "pending"
                              ? "View Credentials"
                              : "View Profile"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {fetching && <div className="p-8 text-center text-sm text-[#6B7280]">Loading users...</div>}

          {filtered.length === 0 && (
            <div className="p-8 text-center text-sm text-[#6B7280]">No users in this filter.</div>
          )}
        </div>

        {selectedHandyman && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-3xl rounded-2xl border border-[#E5E7EB] bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#F3F4F6] px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-[#111827]">Handyman Profile</h2>
                  <p className="text-xs text-[#6B7280]">Review credentials before moderation action.</p>
                </div>
                <button
                  onClick={closeHandymanProfile}
                  className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#F3F4F6]"
                  aria-label="Close profile modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {selectedHandyman.avatarUrl ? (
                      <img
                        src={selectedHandyman.avatarUrl}
                        alt={`${selectedHandyman.name} avatar`}
                        className="h-12 w-12 rounded-full border border-[#E5E7EB] object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0B74FF] text-sm font-bold text-white">
                        {selectedHandyman.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-[#111827]">{selectedHandyman.name}</p>
                      <p className="text-xs text-[#6B7280]">{selectedHandyman.email}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3 text-xs text-[#374151]">
                    <p>
                      Verification status: {" "}
                      <span className="font-semibold">{selectedHandyman.verificationStatus ?? "-"}</span>
                    </p>
                    {selectedVerification && (
                      <p className="mt-1 text-[#6B7280]">
                        Submitted: {new Date(selectedVerification.createdAtUtc).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                      Selfie
                    </p>
                    {selectedVerification?.selfieImageUrl || selectedHandyman.avatarUrl ? (
                      <img
                        src={selectedVerification?.selfieImageUrl ?? selectedHandyman.avatarUrl}
                        alt={`${selectedHandyman.name} selfie`}
                        className="h-40 w-full rounded-xl border border-[#E5E7EB] object-cover"
                      />
                    ) : (
                      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-[#D1D5DB] text-xs text-[#9CA3AF]">
                        No selfie uploaded
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                      Identification Card
                    </p>
                    {selectedVerification?.identityCardUrl ? (
                      <img
                        src={selectedVerification.identityCardUrl}
                        alt={`${selectedHandyman.name} identification card`}
                        className="h-40 w-full rounded-xl border border-[#E5E7EB] object-cover"
                      />
                    ) : (
                      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-[#D1D5DB] text-xs text-[#9CA3AF]">
                        No identification card uploaded
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#F3F4F6] px-5 py-4">
                <button
                  onClick={closeHandymanProfile}
                  className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-xs font-semibold text-[#374151] hover:bg-[#F9FAFB]"
                >
                  Close
                </button>

                {selectedHandyman.verificationStatus === "pending" && (
                  <>
                    <button
                      onClick={() => void handleModalVerification("rejected")}
                      disabled={pendingActionId === selectedHandyman.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                    >
                      <Ban className="h-3.5 w-3.5" /> Reject
                    </button>
                    <button
                      onClick={() => void handleModalVerification("approved")}
                      disabled={pendingActionId === selectedHandyman.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
