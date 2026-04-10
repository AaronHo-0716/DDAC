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
  isActive?: boolean;
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

export interface LogoutRequest {
  refreshToken?: string | null;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

// ─── Account Profile & Settings ─────────────────────────────────────────────

export interface UpdateProfileRequest {
  name?: string;
  avatarUrl?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface NotificationSettings {
  emailBidUpdates: boolean;
  emailJobUpdates: boolean;
  productAnnouncements: boolean;
}

export interface PrivacySettings {
  showProfileToPublic: boolean;
  sharePreciseLocation: boolean;
}

export interface HomeownerSettings {
  defaultEmergency: boolean;
  preferredContactMethod: "email" | "phone";
}

export interface HandymanSettings {
  serviceRadiusKm: number;
  acceptingNewJobs: boolean;
  categories: JobCategory[];
}

export interface UserSettings {
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  homeowner?: HomeownerSettings;
  handyman?: HandymanSettings;
}

export interface UpdateUserSettingsRequest {
  notifications?: Partial<NotificationSettings>;
  privacy?: Partial<PrivacySettings>;
  homeowner?: Partial<HomeownerSettings>;
  handyman?: Partial<HandymanSettings>;
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
  latitude?: number;
  longitude?: number;
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
  latitude?: number;
  longitude?: number;
  budget?: number;
  imageUrls?: string[];
  isEmergency?: boolean;
}

export interface UpdateJobRequest {
  title?: string;
  description?: string;
  category?: JobCategory;
  location?: string;
  latitude?: number;
  longitude?: number;
  budget?: number;
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
  updatedAt: string;
}

export interface CreateBidRequest {
  price: number;
  estimatedArrival: string;
  message: string;
}

export interface BidListResponse {
  bids: Bid[];
  page: number;
  pageSize: number;
  totalCount: number;
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

export interface JobListResponse {
  jobs: Job[];
  page: number;
  pageSize: number;
  totalCount: number;
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
