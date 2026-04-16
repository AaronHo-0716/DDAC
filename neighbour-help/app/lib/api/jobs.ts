import {
  CreateJobRequest,
  Job,
  JobCategory,
  JobListResponse,
  JobStatus,
  UpdateJobRequest,
  User,
  UserRole,
} from "@/app/types";
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

interface RawJobDto {
  id?: string | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  budget?: number | null;
  imageUrls?: string[] | null;
  status?: string | null;
  isEmergency?: boolean | null;
  postedBy?: RawUserDto | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  bidCount?: number | null;
}

interface RawJobListResponse {
  jobs?: RawJobDto[] | null;
  page?: number | null;
  pageSize?: number | null;
  totalCount?: number | null;
}

const KNOWN_CATEGORIES: JobCategory[] = [
  "Plumbing",
  "Electrical",
  "Carpentry",
  "Appliance Repair",
  "General Maintenance",
];

function toUserRole(value?: string | null): UserRole {
  const normalized = (value ?? "homeowner").toLowerCase();
  if (normalized === "admin") return "admin";
  if (normalized === "handyman") return "handyman";
  return "homeowner";
}

function toJobCategory(value?: string | null): JobCategory {
  const candidate = value ?? "General Maintenance";
  if (KNOWN_CATEGORIES.includes(candidate as JobCategory)) {
    return candidate as JobCategory;
  }
  return "General Maintenance";
}

function toJobStatus(value?: string | null): JobStatus {
  const normalized = (value ?? "open").toLowerCase().replace("_", "-");
  if (normalized === "in-progress") return "in-progress";
  if (normalized === "completed") return "completed";
  return "open";
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

function normalizeJob(job: RawJobDto): Job {
  return {
    id: job.id ?? "",
    title: job.title ?? "Untitled job",
    description: job.description ?? "",
    category: toJobCategory(job.category),
    location: job.location ?? "",
    latitude: typeof job.latitude === "number" ? job.latitude : undefined,
    longitude: typeof job.longitude === "number" ? job.longitude : undefined,
    budget: typeof job.budget === "number" ? job.budget : undefined,
    imageUrls: Array.isArray(job.imageUrls) ? job.imageUrls : [],
    status: toJobStatus(job.status),
    isEmergency: !!job.isEmergency,
    postedBy: normalizeUser(job.postedBy),
    createdAt: job.createdAt ?? new Date(0).toISOString(),
    updatedAt: job.updatedAt ?? job.createdAt ?? new Date(0).toISOString(),
    bidCount: typeof job.bidCount === "number" ? job.bidCount : 0,
  };
}

function normalizeJobListResponse(raw: RawJobListResponse): JobListResponse {
  return {
    jobs: Array.isArray(raw.jobs) ? raw.jobs.map(normalizeJob) : [],
    page: raw.page ?? 1,
    pageSize: raw.pageSize ?? 10,
    totalCount: raw.totalCount ?? 0,
  };
}

export const jobsService = {
  /**
   * GET /api/jobs
   * Fetch paginated list of jobs (handyman feed / browse).
   */
  async getJobs(params: JobsQueryParams = {}): Promise<JobListResponse> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) query.set(k, String(v));
    });
    const qs = query.toString();
    const response = await apiClient.get<RawJobListResponse>(`/jobs${qs ? `?${qs}` : ""}`);
    return normalizeJobListResponse(response);
  },

  /**
   * GET /api/jobs/my
   * Fetch jobs posted by the currently authenticated homeowner.
   */
  async getMyJobs(params: Pick<JobsQueryParams, "page" | "pageSize"> = {}): Promise<JobListResponse> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) query.set(k, String(v));
    });
    const qs = query.toString();
    const response = await apiClient.get<RawJobListResponse>(`/jobs/my${qs ? `?${qs}` : ""}`);
    return normalizeJobListResponse(response);
  },

  /**
   * GET /api/jobs/:id
   */
  async getJobById(id: string): Promise<Job> {
    const response = await apiClient.get<RawJobDto>(`/jobs/${id}`);
    return normalizeJob(response);
  },

  /**
   * POST /api/jobs
   */
  async createJob(data: CreateJobRequest): Promise<Job> {
    const response = await apiClient.post<RawJobDto>("/jobs", data);
    return normalizeJob(response);
  },

  /**
   * PUT /api/jobs/:id
   */
  async updateJob(id: string, data: UpdateJobRequest): Promise<Job> {
    const response = await apiClient.put<RawJobDto>(`/jobs/${id}`, data);
    return normalizeJob(response);
  },

  /**
   * DELETE /api/jobs/:id
   */
  async deleteJob(id: string): Promise<void> {
    return apiClient.delete<void>(`/jobs/${id}`);
  },

  /**
   * PATCH /api/jobs/:id/complete
   * Marks an in-progress job as completed.
   */
  async completeJob(id: string): Promise<Job> {
    const response = await apiClient.patch<RawJobDto>(`/jobs/${id}/complete`, {});
    return normalizeJob(response);
  },
};
