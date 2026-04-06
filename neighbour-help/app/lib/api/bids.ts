import {
  Bid,
  BidListResponse,
  BidStatus,
  CreateBidRequest,
  User,
  UserRole,
} from "@/app/types";
import { apiClient } from "./client";

export interface BidsQueryParams {
  page?: number;
  pageSize?: number;
}

interface RawUserDto {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  avatarUrl?: string | null;
  rating?: number | null;
  createdAt?: string | null;
  isActive?: boolean | null;
}

interface RawBidDto {
  id?: string | null;
  jobId?: string | null;
  handyman?: RawUserDto | null;
  price?: number | null;
  estimatedArrival?: string | null;
  message?: string | null;
  status?: string | null;
  isRecommended?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface RawBidListResponse {
  bids?: RawBidDto[] | null;
  page?: number | null;
  pageSize?: number | null;
  totalCount?: number | null;
}

function toUserRole(value?: string | null): UserRole {
  const normalized = (value ?? "homeowner").toLowerCase();
  if (normalized === "admin") return "admin";
  if (normalized === "handyman") return "handyman";
  return "homeowner";
}

function normalizeUser(user?: RawUserDto | null): User {
  return {
    id: user?.id ?? "",
    name: user?.name ?? "Unknown user",
    email: user?.email ?? "",
    role: toUserRole(user?.role),
    avatarUrl: user?.avatarUrl ?? undefined,
    rating: typeof user?.rating === "number" ? user.rating : undefined,
    createdAt: user?.createdAt ?? new Date(0).toISOString(),
    isActive: typeof user?.isActive === "boolean" ? user.isActive : undefined,
  };
}

function toBidStatus(value?: string | null): BidStatus {
  const normalized = (value ?? "pending").toLowerCase();
  if (normalized === "accepted") return "accepted";
  if (normalized === "rejected") return "rejected";
  return "pending";
}

function normalizeBid(bid: RawBidDto): Bid {
  const createdAt = bid.createdAt ?? new Date(0).toISOString();
  return {
    id: bid.id ?? "",
    jobId: bid.jobId ?? "",
    handyman: normalizeUser(bid.handyman),
    price: typeof bid.price === "number" ? bid.price : 0,
    estimatedArrival: bid.estimatedArrival ?? createdAt,
    message: bid.message ?? "",
    status: toBidStatus(bid.status),
    isRecommended: !!bid.isRecommended,
    createdAt,
    updatedAt: bid.updatedAt ?? createdAt,
  };
}

function normalizeBidList(raw: RawBidListResponse): BidListResponse {
  return {
    bids: Array.isArray(raw.bids) ? raw.bids.map(normalizeBid) : [],
    page: raw.page ?? 1,
    pageSize: raw.pageSize ?? 10,
    totalCount: raw.totalCount ?? 0,
  };
}

export const bidsService = {
  /**
   * GET /api/jobs/:jobId/bids
   * Fetch all bids for a specific job.
   */
  async getBidsForJob(jobId: string, params: BidsQueryParams = {}): Promise<BidListResponse> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) query.set(k, String(v));
    });
    const qs = query.toString();
    const response = await apiClient.get<RawBidListResponse>(`/jobs/${jobId}/bids${qs ? `?${qs}` : ""}`);
    return normalizeBidList(response);
  },

  /**
   * POST /api/jobs/:jobId/bids
   * Submit a bid on a job (handyman only).
   */
  async createBid(jobId: string, data: CreateBidRequest): Promise<Bid> {
    const response = await apiClient.post<RawBidDto>(`/jobs/${jobId}/bids`, data);
    return normalizeBid(response);
  },

  /**
   * PATCH /api/bids/:bidId/accept
   * Accept a specific bid (homeowner only). Also transitions the job to in-progress.
   */
  async acceptBid(bidId: string): Promise<Bid> {
    const response = await apiClient.patch<RawBidDto>(`/bids/${bidId}/accept`, {});
    return normalizeBid(response);
  },

  /**
   * PATCH /api/bids/:bidId/reject
   * Reject a specific bid (homeowner only).
   */
  async rejectBid(bidId: string): Promise<Bid> {
    const response = await apiClient.patch<RawBidDto>(`/bids/${bidId}/reject`, {});
    return normalizeBid(response);
  },

  /**
   * DELETE /api/bids/:bidId
   * Retract a bid (handyman only, only if pending).
   */
  async deleteBid(bidId: string): Promise<void> {
    return apiClient.delete<void>(`/bids/${bidId}`);
  },
};
