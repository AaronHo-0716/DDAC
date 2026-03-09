import { Bid, CreateBidRequest } from "@/app/types";
import { apiClient } from "./client";

export const bidsService = {
  /**
   * GET /api/jobs/:jobId/bids
   * Fetch all bids for a specific job.
   */
  async getBidsForJob(jobId: string): Promise<Bid[]> {
    return apiClient.get<Bid[]>(`/jobs/${jobId}/bids`);
  },

  /**
   * POST /api/jobs/:jobId/bids
   * Submit a bid on a job (handyman only).
   */
  async createBid(data: CreateBidRequest): Promise<Bid> {
    return apiClient.post<Bid>(`/jobs/${data.jobId}/bids`, data);
  },

  /**
   * PATCH /api/bids/:bidId/accept
   * Accept a specific bid (homeowner only). Also transitions the job to in-progress.
   */
  async acceptBid(bidId: string): Promise<Bid> {
    return apiClient.patch<Bid>(`/bids/${bidId}/accept`, {});
  },

  /**
   * PATCH /api/bids/:bidId/reject
   * Reject a specific bid (homeowner only).
   */
  async rejectBid(bidId: string): Promise<Bid> {
    return apiClient.patch<Bid>(`/bids/${bidId}/reject`, {});
  },

  /**
   * DELETE /api/bids/:bidId
   * Retract a bid (handyman only, only if pending).
   */
  async deleteBid(bidId: string): Promise<void> {
    return apiClient.delete<void>(`/bids/${bidId}`);
  },
};
