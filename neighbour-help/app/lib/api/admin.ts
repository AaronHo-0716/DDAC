import { apiClient } from "./client";
import type { BidStatus, UserRole } from "@/app/types";

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

export const adminService = {
  async getUsers(): Promise<AdminUserItem[]> {
    return apiClient.get<AdminUserItem[]>("/admin/users");
  },

  async blockUser(userId: string): Promise<void> {
    return apiClient.patch<void>(`/admin/users/${userId}/block`, {});
  },

  async unblockUser(userId: string): Promise<void> {
    return apiClient.patch<void>(`/admin/users/${userId}/unblock`, {});
  },

  async updateVerification(userId: string, status: VerificationStatus): Promise<void> {
    return apiClient.patch<void>(`/admin/users/${userId}/verification`, { status });
  },

  async getBidTransactions(): Promise<BidTransactionItem[]> {
    return apiClient.get<BidTransactionItem[]>("/admin/transactions/bids");
  },

  async setBidFlag(transactionId: string, flagged: boolean): Promise<void> {
    return apiClient.patch<void>(`/admin/transactions/bids/${transactionId}/flag`, { flagged });
  },

  async setBidLock(transactionId: string, locked: boolean): Promise<void> {
    return apiClient.patch<void>(`/admin/transactions/bids/${transactionId}/lock`, { locked });
  },

  async forceRejectBid(transactionId: string): Promise<void> {
    return apiClient.patch<void>(`/admin/transactions/bids/${transactionId}/force-reject`, {});
  },
};
