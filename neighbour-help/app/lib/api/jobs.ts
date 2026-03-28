import { CreateJobRequest, Job, PaginatedResponse } from "@/app/types";
import { apiClient } from "./client";

export interface JobsQueryParams {
  page?: number;
  pageSize?: number;
  category?: string;
  status?: string;
  search?: string;
  isEmergency?: boolean;
  maxDistanceKm?: number;
}

export const jobsService = {
  /**
   * GET /api/jobs
   * Fetch paginated list of jobs (handyman feed / browse).
   */
  async getJobs(params: JobsQueryParams = {}): Promise<PaginatedResponse<Job>> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) query.set(k, String(v));
    });
    const qs = query.toString();
    return apiClient.get<PaginatedResponse<Job>>(`/jobs${qs ? `?${qs}` : ""}`);
  },

  /**
   * GET /api/jobs/my
   * Fetch jobs posted by the currently authenticated homeowner.
   */
  async getMyJobs(): Promise<PaginatedResponse<Job>> {
    return apiClient.get<PaginatedResponse<Job>>("/jobs/my");
  },

  /**
   * GET /api/jobs/:id
   */
  async getJobById(id: string): Promise<Job> {
    return apiClient.get<Job>(`/jobs/${id}`);
  },

  /**
   * POST /api/jobs
   */
  async createJob(data: CreateJobRequest): Promise<Job> {
    return apiClient.post<Job>("/jobs", data);
  },

  /**
   * PUT /api/jobs/:id
   */
  async updateJob(id: string, data: Partial<CreateJobRequest>): Promise<Job> {
    return apiClient.put<Job>(`/jobs/${id}`, data);
  },

  /**
   * DELETE /api/jobs/:id
   */
  async deleteJob(id: string): Promise<void> {
    return apiClient.delete<void>(`/jobs/${id}`);
  },
};
