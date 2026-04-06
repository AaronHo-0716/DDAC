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
    const users = await apiClient.get<RawUserDto[]>("/users");
    return Array.isArray(users) ? users.map(toAdminUser) : [];
  },

  async blockUser(userId: string): Promise<void> {
    throw new Error("Block user endpoint is not available in the current API spec.");
  },

  async unblockUser(userId: string): Promise<void> {
    throw new Error("Unblock user endpoint is not available in the current API spec.");
  },

  async updateVerification(userId: string, status: VerificationStatus): Promise<void> {
    throw new Error("Verification update endpoint is not available in the current API spec.");
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
    throw new Error("Bid flag endpoint is not available in the current API spec.");
  },

  async setBidLock(transactionId: string, locked: boolean): Promise<void> {
    throw new Error("Bid lock endpoint is not available in the current API spec.");
  },

  async forceRejectBid(transactionId: string): Promise<void> {
    await bidsService.rejectBid(transactionId);
  },
};
