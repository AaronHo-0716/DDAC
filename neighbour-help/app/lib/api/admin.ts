import { apiClient } from "./client";
import type { BidStatus, ReportStatus, UserReport, UserRole } from "@/app/types";
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
  avatarUrl?: string;
  blockReason?: string;
  createdAt: string;
}

export interface AdminHandymanVerification {
  id: string;
  userId: string;
  userName: string;
  status: VerificationStatus;
  identityCardUrl?: string;
  selfieImageUrl?: string;
  createdAtUtc: string;
  updatedAtUtc: string;
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

export interface AdminOverview {
  usersCreatedToday: number;
  jobsPostedToday: number;
  bidsCreatedToday: number;
  openEmergencies: number;
  blockedAccountCount: number;
}

interface RawUserDto {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  avatarUrl?: string | null;
  isActive?: boolean | null;
  verification?: string | null;
  createdAt?: string | null;
}

interface RawHandymanVerificationDto {
  id?: string | null;
  userId?: string | null;
  userName?: string | null;
  status?: string | null;
  identityCardURL?: string | null;
  selfieImageUrl?: string | null;
  createdAtUtc?: string | null;
  updatedAtUtc?: string | null;
}

interface RawUserReportDto {
  id?: string | null;
  reporterId?: string | null;
  reporterName?: string | null;
  targetUserId?: string | null;
  targetUserName?: string | null;
  reason?: string | null;
  description?: string | null;
  status?: string | null;
  createdAtUtc?: string | null;
  adminId?: string | null;
  adminName?: string | null;
  reviewAtUtc?: string | null;
  adminNotes?: string | null;
}

interface RawAdminOverviewResponse {
  usersCreatedToday?: number | null;
  jobsPostedToday?: number | null;
  bidsCreatedToday?: number | null;
  openEmergencies?: number | null;
  blockedAccountCount?: number | null;
}

function normalizeRole(value?: string | null): UserRole {
  const normalized = (value ?? "homeowner").toLowerCase();
  if (normalized === "admin") return "admin";
  if (normalized === "handyman") return "handyman";
  return "homeowner";
}

function normalizeVerificationStatus(value?: string | null): VerificationStatus {
  const normalized = (value ?? "pending").toLowerCase();
  if (normalized === "approved") return "approved";
  if (normalized === "rejected") return "rejected";
  return "pending";
}

const DEFAULT_STORAGE_PUBLIC_BASE_URL = "http://localhost:4566";
const DEFAULT_STORAGE_BUCKET = "neighbourhelp-media";

export function resolveStoredImageUrl(value?: string | null): string | undefined {
  if (!value) return undefined;

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const objectKey = value.replace(/^\/+/, "");
  if (!objectKey) return undefined;

  const baseUrl =
    process.env.NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL ??
    DEFAULT_STORAGE_PUBLIC_BASE_URL;
  const bucketName =
    process.env.NEXT_PUBLIC_STORAGE_BUCKET_NAME ?? DEFAULT_STORAGE_BUCKET;

  return `${baseUrl.replace(/\/+$/, "")}/${bucketName}/${objectKey}`;
}

function toAdminHandymanVerification(
  row: RawHandymanVerificationDto
): AdminHandymanVerification {
  return {
    id: row.id ?? "",
    userId: row.userId ?? "",
    userName: row.userName ?? "Unknown handyman",
    status: normalizeVerificationStatus(row.status),
    identityCardUrl: resolveStoredImageUrl(row.identityCardURL),
    selfieImageUrl: resolveStoredImageUrl(row.selfieImageUrl),
    createdAtUtc: row.createdAtUtc ?? new Date(0).toISOString(),
    updatedAtUtc: row.updatedAtUtc ?? new Date(0).toISOString(),
  };
}

function toAdminUser(row: RawUserDto): AdminUserItem {
  const role = normalizeRole(row.role);
  const verificationStatus: VerificationStatus | undefined =
    role === "handyman"
      ? normalizeVerificationStatus(row.verification)
      : undefined;

  return {
    id: row.id ?? "",
    name: row.name ?? "Unknown user",
    email: row.email ?? "",
    role,
    status: row.isActive === false ? "blocked" : "active",
    verificationStatus,
    avatarUrl: resolveStoredImageUrl(row.avatarUrl),
    createdAt: row.createdAt ?? new Date(0).toISOString(),
  };
}

function normalizeReportStatus(value?: string | null): ReportStatus {
  const normalized = (value ?? "pending").toLowerCase();
  if (normalized === "reviewed") return "reviewed";
  if (normalized === "resolved") return "resolved";
  return "pending";
}

function toUserReport(row: RawUserReportDto): UserReport {
  return {
    id: row.id ?? "",
    reporterId: row.reporterId ?? "",
    reporterName: row.reporterName ?? "Unknown reporter",
    targetUserId: row.targetUserId ?? "",
    targetUserName: row.targetUserName ?? "Unknown user",
    reason: row.reason ?? "",
    description: row.description ?? "",
    status: normalizeReportStatus(row.status),
    createdAtUtc: row.createdAtUtc ?? new Date(0).toISOString(),
    adminId: row.adminId ?? undefined,
    adminName: row.adminName ?? undefined,
    reviewAtUtc: row.reviewAtUtc ?? undefined,
    adminNotes: row.adminNotes ?? undefined,
  };
}

function toAdminOverview(row?: RawAdminOverviewResponse | null): AdminOverview {
  return {
    usersCreatedToday: typeof row?.usersCreatedToday === "number" ? row.usersCreatedToday : 0,
    jobsPostedToday: typeof row?.jobsPostedToday === "number" ? row.jobsPostedToday : 0,
    bidsCreatedToday: typeof row?.bidsCreatedToday === "number" ? row.bidsCreatedToday : 0,
    openEmergencies: typeof row?.openEmergencies === "number" ? row.openEmergencies : 0,
    blockedAccountCount: typeof row?.blockedAccountCount === "number" ? row.blockedAccountCount : 0,
  };
}

export const adminService = {
  async getOverview(): Promise<AdminOverview> {
    const response = await apiClient.get<RawAdminOverviewResponse>("/admin/overview");
    return toAdminOverview(response);
  },

  async createAdmin(name: string, email: string, password: string): Promise<AdminUserItem> {
    const created = await apiClient.post<RawUserDto>("/admin/new-admin", {
      name,
      email,
      password,
      role: "admin",
    });

    return toAdminUser(created);
  },

  async getUsers(): Promise<AdminUserItem[]> {
    const users = await apiClient.get<RawUserDto[]>("/admin/users?page=1&pageSize=200");

    if (!Array.isArray(users)) return [];

    return users.map((row) => toAdminUser(row));
  },

  async getPendingVerificationRecords(): Promise<AdminHandymanVerification[]> {
    const pending = await apiClient.get<RawHandymanVerificationDto[]>(
      "/admin/handymen/pending-verification"
    );

    if (!Array.isArray(pending)) return [];
    return pending.map((row) => toAdminHandymanVerification(row));
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

  async getReports(status?: ReportStatus): Promise<UserReport[]> {
    const query = new URLSearchParams();
    if (status) query.set("status", status);

    const suffix = query.toString();
    const path = suffix ? `/admin/report?${suffix}` : "/admin/report";
    const reports = await apiClient.get<RawUserReportDto[]>(path);

    if (!Array.isArray(reports)) return [];
    return reports.map((row) => toUserReport(row));
  },

  async resolveReport(reportId: string, notes: string): Promise<void> {
    await apiClient.patch<void>(`/admin/report/${reportId}/resolve`, notes);
  },

  async reviewReport(reportId: string, notes: string): Promise<void> {
    await apiClient.patch<void>(`/admin/report/${reportId}/review`, notes);
  },
};
