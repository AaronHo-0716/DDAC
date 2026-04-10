import { apiClient } from "./client";
import type { BidStatus, UserRole } from "@/app/types";
import { bidsService } from "./bids";
import { jobsService } from "./jobs";

export type VerificationStatus = "pending" | "approved" | "rejected";
export type UserStatus = "active" | "blocked";

export interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  verificationStatus?: VerificationStatus;
  blockReason?: string;
  createdAt: string;
}

export type AdminBidStatus = BidStatus | "retracted";

export interface BidTransactionItem {
  id: string;
  jobTitle: string;
  homeownerName: string;
  handymanName: string;
  price: number;
  status: AdminBidStatus;
  emergency: boolean;
  createdAt: string;
  flagged: boolean;
  locked: boolean;
}

interface RawUserDto {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  isActive?: boolean | null;
  createdAt?: string | null;
}

interface RawHandymanVerificationDto {
  id?: string | null;
  userId?: string | null;
  status?: string | null;
}

function normalizeRole(value?: string | null): UserRole {
  const normalized = (value ?? "homeowner").toLowerCase();
  if (normalized === "admin") return "admin";
  if (normalized === "handyman") return "handyman";
  return "homeowner";
}

function toAdminUser(row: RawUserDto): AdminUserItem {
  return {
    id: row.id ?? "",
    name: row.name ?? "Unknown user",
    email: row.email ?? "",
    role: normalizeRole(row.role),
    status: row.isActive === false ? "blocked" : "active",
    createdAt: row.createdAt ?? new Date(0).toISOString(),
  };
}

export const adminService = {
  async getUsers(): Promise<AdminUserItem[]> {
    const [users, pendingVerifications] = await Promise.all([
      apiClient.get<RawUserDto[]>("/admin/users?page=1&pageSize=200"),
      apiClient
        .get<RawHandymanVerificationDto[]>("/admin/handymen/pending-verification")
        .catch(() => [] as RawHandymanVerificationDto[]),
    ]);

    const pendingByUserId = new Map(
      (Array.isArray(pendingVerifications) ? pendingVerifications : [])
        .filter((v) => v.userId && v.status?.toLowerCase() === "pending")
        .map((v) => [v.userId as string, v])
    );

    if (!Array.isArray(users)) return [];

    return users.map((row) => {
      const user = toAdminUser(row);
      if (user.role === "handyman" && pendingByUserId.has(user.id)) {
        return { ...user, verificationStatus: "pending" as const };
      }
      return user;
    });
  },

  async blockUser(userId: string): Promise<void> {
    await apiClient.patch(`/admin/users/${userId}/block`, {
      reason: "Blocked by admin moderation",
    });
  },

  async unblockUser(userId: string): Promise<void> {
    await apiClient.patch(`/admin/users/${userId}/unblock`, {});
  },

  async updateVerification(userId: string, status: VerificationStatus): Promise<void> {
    const pending = await apiClient.get<RawHandymanVerificationDto[]>(
      "/admin/handymen/pending-verification"
    );

    const record = (Array.isArray(pending) ? pending : []).find(
      (v) => v.userId === userId && v.status?.toLowerCase() === "pending"
    );

    if (!record?.id) {
      throw new Error("No pending verification record found for this handyman.");
    }

    if (status === "approved") {
      await apiClient.patch(`/admin/handymen/${record.id}/approve`, "Approved by admin");
      return;
    }

    await apiClient.patch(`/admin/handymen/${record.id}/reject`, "Rejected by admin");
  },

  async getBidTransactions(): Promise<BidTransactionItem[]> {
    const jobsResponse = await jobsService.getJobs({ page: 1, pageSize: 100 });
    const jobs = jobsResponse.jobs ?? [];

    const perJobResults = await Promise.all(
      jobs.map(async (job) => {
        try {
          const bidResponse = await bidsService.getBidsForJob(job.id, { page: 1, pageSize: 100 });
          const bids = bidResponse.bids ?? [];
          return bids.map<BidTransactionItem>((bid) => ({
            id: bid.id,
            jobTitle: job.title,
            homeownerName: job.postedBy.name,
            handymanName: bid.handyman.name,
            price: bid.price,
            status: bid.status,
            emergency: job.isEmergency,
            createdAt: bid.createdAt,
            flagged: false,
            locked: false,
          }));
        } catch {
          return [];
        }
      })
    );

    return perJobResults.flat().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  },

  async setBidFlag(transactionId: string, flagged: boolean): Promise<void> {
    const reason = flagged
      ? "Flagged by admin from dashboard"
      : "Unflag requested by admin from dashboard";
    await apiClient.patch(`/admin/bid-transactions/${transactionId}/flag`, reason);
  },

  async setBidLock(transactionId: string, locked: boolean): Promise<void> {
    const reason = locked
      ? "Locked by admin from dashboard"
      : "Unlock requested by admin from dashboard";
    await apiClient.patch(`/admin/bid-transactions/${transactionId}/lock`, reason);
  },

  async forceRejectBid(transactionId: string): Promise<void> {
    await apiClient.patch(
      `/admin/bid-transactions/${transactionId}/force-reject`,
      "Force rejected by admin"
    );
  },
};
