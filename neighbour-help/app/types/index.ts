// ─── Auth ────────────────────────────────────────────────────────────────────

export type UserRole = "homeowner" | "handyman" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  rating?: number;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

// ─── Jobs ────────────────────────────────────────────────────────────────────

export type JobCategory =
  | "Plumbing"
  | "Electrical"
  | "Carpentry"
  | "Appliance Repair"
  | "General Maintenance";

export type JobStatus = "open" | "in-progress" | "completed";

export interface Job {
  id: string;
  title: string;
  description: string;
  category: JobCategory;
  location: string;
  budget?: number;
  imageUrls: string[];
  status: JobStatus;
  isEmergency: boolean;
  postedBy: User;
  createdAt: string;
  updatedAt: string;
  bidCount: number;
}

export interface CreateJobRequest {
  title: string;
  description: string;
  category: JobCategory;
  location: string;
  budget?: number;
  imageUrls?: string[];
  isEmergency?: boolean;
}

// ─── Bids ────────────────────────────────────────────────────────────────────

export type BidStatus = "pending" | "accepted" | "rejected";

export interface Bid {
  id: string;
  jobId: string;
  handyman: User;
  price: number;
  estimatedArrival: string; // ISO date string
  message: string;
  status: BidStatus;
  isRecommended: boolean;
  createdAt: string;
}

export interface CreateBidRequest {
  jobId: string;
  price: number;
  estimatedArrival: string;
  message: string;
}

// ─── API Shared ───────────────────────────────────────────────────────────────

export interface ApiError {
  statusCode: number;
  message: string;
  errors?: Record<string, string[]>; // ASP.NET validation errors shape
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── Notifications ───────────────────────────────────────────────────────────

export type NotificationEventType =
  | "bid_received"
  | "bid_accepted"
  | "handyman_arriving"
  | "job_completed";

export interface Notification {
  id: string;
  type: NotificationEventType;
  message: string;
  read: boolean;
  createdAt: string;
  relatedJobId?: string;
}
