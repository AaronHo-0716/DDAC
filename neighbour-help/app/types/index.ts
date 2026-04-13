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

export type ConversationType = "job_chat" | "admin_support";
export type ConversationStatus = "active" | "locked" | "closed";
export type MessageType = "text" | "system" | "admin_note";

export interface ConversationParticipant {
  userId: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
}

export interface ConversationSummary {
  id: string;
  type: ConversationType;
  status: ConversationStatus;
  relatedJobId?: string;
  relatedBidId?: string;
  lastMessagePreview?: string;
  lastMessageAt?: string;
  unreadCount: number;
  participants: ConversationParticipant[];
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderName?: string;
  messageType: MessageType;
  bodyText: string;
  createdAt: string;
  isDeleted?: boolean;
}

export interface ConversationListResponse {
  conversations: ConversationSummary[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface MessageListResponse {
  messages: ChatMessage[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface CreateOrOpenJobConversationRequest {
  jobId: string;
  bidId: string;
  otherUserId: string;
}

export interface SendMessageRequest {
  bodyText: string;
  messageType?: MessageType;
  clientMessageId?: string;
}

export interface UnreadCountResponse {
  unreadCount: number;
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
