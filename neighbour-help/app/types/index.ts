// ─── Auth ────────────────────────────────────────────────────────────────────

export type UserRole = "homeowner" | "handyman" | "admin";
export type VerificationStatus = "pending" | "approved" | "rejected";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  rating?: number;
  createdAt: string;
  isActive?: boolean;
  verification?: VerificationStatus;
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

export interface ForgotPasswordOtpRequest {
  email: string;
}

export interface ForgotPasswordOtpResponse {
  message: string;
  expiresInSeconds?: number;
  cooldownSeconds?: number;
}

export interface VerifyPasswordOtpRequest {
  email: string;
  otp: string;
}

export interface VerifyPasswordOtpResponse {
  verified: boolean;
  message?: string;
  resetToken?: string;
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

export interface UploadImageResponse {
  objectKey: string;
  url: string;
  size: number;
  contentType: string;
}

// ─── Bids ────────────────────────────────────────────────────────────────────

export type BidStatus = "pending" | "accepted" | "rejected";

export interface Bid {
  id: string;
  jobId: string;
  jobName?: string;
  handyman: User;
  price: number;
  estimatedArrival: string; // ISO date string
  message: string;
  status: BidStatus;
  isRecommended: boolean;
  isLocked?: boolean;
  isFlagged?: boolean;
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
  | "bid_rejected"
  | "bid_accepted"
  | "handyman_arriving"
  | "job_completed"
  | "system";

export interface Notification {
  id: string;
  type: NotificationEventType;
  message: string;
  read: boolean;
  createdAt: string;
  relatedJobId?: string;
}

export interface NotificationListResponse {
  notifications: Notification[];
  unreadCount: number;
}

// ─── Messaging ───────────────────────────────────────────────────────────────

export enum ConversationType {
  JobChat = "JobChat",
  AdminSupport = "AdminSupport"
}
export type MessageType = "text" | "image" | "system";
export type ConversationStatus = "active" | "locked";

export interface ChatParticipant {
  userId: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  averageRating?: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  type: MessageType;
  content: string; 
  createdAtUtc: string;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  createdAtUtc: string;
  lastMessageAtUtc?: string;
  unreadCount: number;
  lastMessage?: ChatMessage;
  participants: ChatParticipant[];
}

export interface CreateJobChatRequest {
  jobId: string;
  bidId: string;
}

export interface SendMessageRequest {
  content: string;
  messageType: MessageType;
}

export interface UnreadCountResponse {
  totalUnread: number;
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export type ReportStatus = "pending" | "reviewed" | "resolved";

export interface UserReport {
  id: string;
  reporterId: string;
  reporterName: string;
  targetUserId: string;
  targetUserName: string;
  reason: string;
  description: string;
  status: ReportStatus;
  createdAtUtc: string;
  adminId?: string;
  adminName?: string;
  reviewAtUtc?: string;
  adminNotes?: string;
}

export interface CreateReportRequest {
  targetUserId: string;
  reason: string;
  description: string;
}
