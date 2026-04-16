import { ApiClientError, apiClient } from "./client";
import type {
  BidStatus,
  Job,
  JobCategory,
  ReportStatus,
  UserReport,
  UserRole,
} from "@/app/types";
import { bidsService } from "./bids";
import type { JobsQueryParams } from "./jobs";

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
  rating?: number | null;
  isActive?: boolean | null;
  verification?: string | null;
  blockedReason?: string | null;
  createdAt?: string | null;
}

interface RawHandymanVerificationDto {
  id?: string | null;
  userId?: string | null;
  userName?: string | null;
  status?: string | null;
  identityCardURL?: string | null;
  identityCardUrl?: string | null;
  selfieImageURL?: string | null;
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

interface ReportListResponse {
  data: RawUserReportDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

interface RawAdminOverviewResponse {
  usersCreatedToday?: number | null;
  jobsPostedToday?: number | null;
  bidsCreatedToday?: number | null;
  openEmergencies?: number | null;
  blockedAccountCount?: number | null;
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
  data?: RawJobDto[] | null;
  page?: number | null;
  pageSize?: number | null;
  totalCount?: number | null;
}

interface RawBidTransactionListResponse {
  data?: RawAdminBidTransactionDto[] | null;
  items?: RawAdminBidTransactionDto[] | null;
}

interface RawAdminBidTransactionDto {
  id?: string | null;
  bidId?: string | null;
  jobId?: string | null;
  eventType?: string | null;
  eventReason?: string | null;
  createdAtUtc?: string | null;
  createdAt?: string | null;
  jobTitle?: string | null;
  homeownerName?: string | null;
  handymanName?: string | null;
  price?: number | null;
  status?: string | null;
  emergency?: boolean | null;
  isEmergency?: boolean | null;
  flagged?: boolean | null;
  locked?: boolean | null;
}

interface BidLedgerEvent {
  bidId: string;
  jobId: string;
  eventType: string;
  createdAt: string;
  jobTitle?: string;
  homeownerName?: string;
  handymanName?: string;
  price?: number;
  emergency?: boolean;
}

function normalizeRole(value?: string | null): UserRole {
  const normalized = (value ?? "homeowner").toLowerCase();
  if (normalized === "admin") return "admin";
  if (normalized === "handyman") return "handyman";
  return "homeowner";
}

const KNOWN_CATEGORIES: JobCategory[] = [
  "Plumbing",
  "Electrical",
  "Carpentry",
  "Appliance Repair",
  "General Maintenance",
];

function toJobCategory(value?: string | null): JobCategory {
  const candidate = value ?? "General Maintenance";
  if (KNOWN_CATEGORIES.includes(candidate as JobCategory)) {
    return candidate as JobCategory;
  }
  return "General Maintenance";
}

function toJobStatus(value?: string | null): Job["status"] {
  const normalized = (value ?? "open").toLowerCase().replace("_", "-");
  if (normalized === "in-progress") return "in-progress";
  if (normalized === "completed") return "completed";
  return "open";
}

function toBackendJobStatus(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase().replace("_", "-");
  if (normalized === "open") return "Open";
  if (normalized === "in-progress") return "InProgress";
  if (normalized === "completed") return "Completed";
  return undefined;
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

function normalizeUser(row?: RawUserDto | null) {
  return {
    id: row?.id ?? "",
    name: row?.name ?? "Unknown user",
    email: row?.email ?? "",
    role: normalizeRole(row?.role),
    avatarUrl: resolveStoredImageUrl(row?.avatarUrl),
    rating: typeof row?.rating === "number" ? row.rating : undefined,
    createdAt: row?.createdAt ?? new Date(0).toISOString(),
    isActive: typeof row?.isActive === "boolean" ? row.isActive : undefined,
    verification: row?.verification ? normalizeVerificationStatus(row.verification) : undefined,
  };
}

function normalizeJob(row: RawJobDto): Job {
  return {
    id: row.id ?? "",
    title: row.title ?? "Untitled job",
    description: row.description ?? "",
    category: toJobCategory(row.category),
    location: row.location ?? "",
    latitude: typeof row.latitude === "number" ? row.latitude : undefined,
    longitude: typeof row.longitude === "number" ? row.longitude : undefined,
    budget: typeof row.budget === "number" ? row.budget : undefined,
    imageUrls: Array.isArray(row.imageUrls)
      ? row.imageUrls
          .map((url) => resolveStoredImageUrl(url) ?? url)
          .filter((url): url is string => Boolean(url))
      : [],
    status: toJobStatus(row.status),
    isEmergency: !!row.isEmergency,
    postedBy: normalizeUser(row.postedBy),
    createdAt: row.createdAt ?? new Date(0).toISOString(),
    updatedAt: row.updatedAt ?? row.createdAt ?? new Date(0).toISOString(),
    bidCount: typeof row.bidCount === "number" ? row.bidCount : 0,
  };
}

function toAdminHandymanVerification(
  row: RawHandymanVerificationDto
): AdminHandymanVerification {
  return {
    id: row.id ?? "",
    userId: row.userId ?? "",
    userName: row.userName ?? "Unknown handyman",
    status: normalizeVerificationStatus(row.status),
    identityCardUrl: resolveStoredImageUrl(row.identityCardURL ?? row.identityCardUrl),
    selfieImageUrl: resolveStoredImageUrl(row.selfieImageUrl ?? row.selfieImageURL),
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
    blockReason: row.blockedReason ?? undefined,
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

function toAdminBidStatus(value?: string | null): AdminBidStatus {
  const normalized = (value ?? "pending").toLowerCase().replace("_", "-");
  if (normalized === "accepted") return "accepted";
  if (normalized === "rejected" || normalized === "force-rejected") return "rejected";
  if (normalized === "retracted") return "retracted";
  return "pending";
}

function statusFromEventType(eventType: string): AdminBidStatus | undefined {
  if (eventType === "accepted") return "accepted";
  if (eventType === "rejected" || eventType === "force_rejected") return "rejected";
  if (eventType === "retracted") return "retracted";
  if (eventType === "created") return "pending";
  return undefined;
}

function normalizeBidEventType(value?: string | null): string {
  return (value ?? "").toLowerCase().trim().replace(/-/g, "_");
}

function unwrapDataArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];

  if (payload && typeof payload === "object") {
    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data)) return data as T[];

    const items = (payload as { items?: unknown }).items;
    if (Array.isArray(items)) return items as T[];
  }

  return [];
}

function extractVerification(payload: unknown): RawHandymanVerificationDto | null {
  if (!payload || typeof payload !== "object") return null;

  const maybeData = (payload as { data?: unknown }).data;
  const candidate =
    maybeData && typeof maybeData === "object"
      ? (maybeData as RawHandymanVerificationDto)
      : (payload as RawHandymanVerificationDto);

  if (
    candidate.id ||
    candidate.userId ||
    candidate.identityCardURL ||
    candidate.identityCardUrl ||
    candidate.selfieImageUrl ||
    candidate.selfieImageURL
  ) {
    return candidate;
  }

  return null;
}

function extractJobRows(payload: unknown): RawJobDto[] | null {
  if (Array.isArray(payload)) return payload as RawJobDto[];

  if (payload && typeof payload === "object") {
    const response = payload as RawJobListResponse;
    if (Array.isArray(response.jobs)) return response.jobs;
    if (Array.isArray(response.data)) return response.data;
  }

  return null;
}

function extractBidTransactionRows(payload: unknown): RawAdminBidTransactionDto[] {
  if (Array.isArray(payload)) return payload as RawAdminBidTransactionDto[];

  if (payload && typeof payload === "object") {
    const response = payload as RawBidTransactionListResponse;
    if (Array.isArray(response.data)) return response.data;
    if (Array.isArray(response.items)) return response.items;
  }

  return [];
}

function isRichBidTransactionRow(row: RawAdminBidTransactionDto): boolean {
  return Boolean(
    row.jobTitle ||
      row.homeownerName ||
      row.handymanName ||
      typeof row.price === "number" ||
      typeof row.flagged === "boolean" ||
      typeof row.locked === "boolean" ||
      typeof row.status === "string"
  );
}

function toBidTransactionFromRichRow(row: RawAdminBidTransactionDto): BidTransactionItem | null {
  const id = row.bidId ?? row.id;
  if (!id) return null;

  const createdAt = row.createdAt ?? row.createdAtUtc ?? new Date(0).toISOString();

  return {
    id,
    jobTitle: row.jobTitle ?? (row.jobId ? `Job ${row.jobId.slice(0, 8)}` : "Unknown job"),
    homeownerName: row.homeownerName ?? "Unknown homeowner",
    handymanName: row.handymanName ?? "Unknown handyman",
    price: typeof row.price === "number" ? row.price : 0,
    status: toAdminBidStatus(row.status ?? row.eventType),
    emergency: typeof row.emergency === "boolean" ? row.emergency : !!row.isEmergency,
    createdAt,
    flagged: !!row.flagged,
    locked: !!row.locked,
  };
}

function toLedgerEvent(row: RawAdminBidTransactionDto): BidLedgerEvent | null {
  if (!row.bidId || !row.jobId) return null;

  return {
    bidId: row.bidId,
    jobId: row.jobId,
    eventType: normalizeBidEventType(row.eventType),
    createdAt: row.createdAtUtc ?? row.createdAt ?? new Date(0).toISOString(),
    jobTitle: row.jobTitle ?? undefined,
    homeownerName: row.homeownerName ?? undefined,
    handymanName: row.handymanName ?? undefined,
    price: typeof row.price === "number" ? row.price : undefined,
    emergency:
      typeof row.emergency === "boolean"
        ? row.emergency
        : typeof row.isEmergency === "boolean"
          ? row.isEmergency
          : undefined,
  };
}

function dedupeBidTransactions(rows: BidTransactionItem[]): BidTransactionItem[] {
  const map = new Map<string, BidTransactionItem>();

  rows.forEach((row) => {
    const existing = map.get(row.id);
    if (!existing || +new Date(row.createdAt) > +new Date(existing.createdAt)) {
      map.set(row.id, row);
    }
  });

  return Array.from(map.values()).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

function buildJobQuery(params: JobsQueryParams = {}): URLSearchParams {
  const query = new URLSearchParams();

  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.pageSize !== undefined) query.set("pageSize", String(params.pageSize));
  if (params.category) query.set("category", params.category);
  if (params.search) query.set("search", params.search);
  if (params.isEmergency !== undefined) query.set("isEmergency", String(params.isEmergency));
  if (params.maxDistanceKm !== undefined) query.set("maxDistanceKm", String(params.maxDistanceKm));

  const backendStatus = toBackendJobStatus(params.status);
  if (backendStatus) query.set("status", backendStatus);

  return query;
}

async function fetchPublicJobs(params: JobsQueryParams = {}): Promise<Job[]> {
  const query = buildJobQuery(params);
  const qs = query.toString();
  const payload = await apiClient.get<unknown>(`/jobs${qs ? `?${qs}` : ""}`);
  const rows = extractJobRows(payload);
  if (!rows) return [];
  return rows.map((row) => normalizeJob(row));
}

async function fetchAdminJobsViaDedicatedEndpoint(
  params: JobsQueryParams = {}
): Promise<Job[] | null> {
  const query = buildJobQuery(params);
  const qs = query.toString();
  const paths = ["/admin/jobs", "/admin/jobs/all"];

  for (const path of paths) {
    try {
      const payload = await apiClient.get<unknown>(`${path}${qs ? `?${qs}` : ""}`);
      const rows = extractJobRows(payload);
      if (rows !== null) {
        return rows.map((row) => normalizeJob(row));
      }
    } catch (error) {
      if (error instanceof ApiClientError && [404, 405].includes(error.statusCode)) {
        continue;
      }
      continue;
    }
  }

  return null;
}

async function fetchAdminJobsWithFallback(params: JobsQueryParams = {}): Promise<Job[]> {
  const adminJobs = await fetchAdminJobsViaDedicatedEndpoint(params);
  if (adminJobs !== null) return adminJobs;

  if (params.status) {
    return fetchPublicJobs(params);
  }

  const baseParams = { ...params };
  delete baseParams.status;

  const statusQueries: Array<Job["status"]> = ["open", "in-progress", "completed"];
  const settled = await Promise.allSettled(
    statusQueries.map((status) => fetchPublicJobs({ ...baseParams, status }))
  );

  const merged = new Map<string, Job>();
  settled.forEach((result) => {
    if (result.status === "fulfilled") {
      result.value.forEach((job) => {
        merged.set(job.id, job);
      });
    }
  });

  if (merged.size > 0) {
    return Array.from(merged.values()).sort(
      (a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)
    );
  }

  return fetchPublicJobs(baseParams);
}

export const adminService = {
  async getOverview(): Promise<AdminOverview> {
    const response = await apiClient.get<RawAdminOverviewResponse>("/admin/overview");
    return toAdminOverview(response);
  },

  async getJobs(params: JobsQueryParams = {}): Promise<Job[]> {
    return fetchAdminJobsWithFallback(params);
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

  async getUsers(page = 1, pageSize = 200): Promise<AdminUserItem[]> {
    const response = await apiClient.get<unknown>(
      `/admin/users?page=${page}&pageSize=${pageSize}`
    );

    const rows = unwrapDataArray<RawUserDto>(response);
    return rows.map((row) => toAdminUser(row));
  },

  async getPendingVerificationRecords(page = 1, pageSize = 1000): Promise<AdminHandymanVerification[]> {
    const response = await apiClient.get<unknown>(
      `/admin/handymen/pending-verification?page=${page}&pageSize=${pageSize}`
    );

    const rows = unwrapDataArray<RawHandymanVerificationDto>(response);
    return rows.map((row) => toAdminHandymanVerification(row));
  },

  async getHandymanVerification(
    userId: string,
    verificationRecordId?: string
  ): Promise<AdminHandymanVerification | null> {
    const ids = Array.from(new Set([verificationRecordId, userId].filter(Boolean))) as string[];

    for (const id of ids) {
      try {
        const response = await apiClient.get<unknown>(`/admin/handyman/${id}`);
        const record = extractVerification(response);
        if (record) {
          return toAdminHandymanVerification(record);
        }
      } catch {
        // Try the next candidate id.
      }
    }

    return null;
  },

  async blockUser(userId: string): Promise<void> {
    await apiClient.patch(`/admin/users/${userId}/block`, {
      reason: "Blocked by admin moderation",
    });
  },

  async unblockUser(userId: string): Promise<void> {
    await apiClient.patch(`/admin/users/${userId}/unblock`, {});
  },

  async updateVerification(
    userId: string,
    status: VerificationStatus,
    verificationRecordId?: string
  ): Promise<void> {
    let targetRecordId = verificationRecordId;

    if (!targetRecordId) {
      const pendingResponse = await apiClient.get<unknown>(
      "/admin/handymen/pending-verification"
    );

      const pending = unwrapDataArray<RawHandymanVerificationDto>(pendingResponse);
      const record = pending.find((v) => v.userId === userId && v.status?.toLowerCase() === "pending");
      targetRecordId = record?.id ?? undefined;
    }

    if (!targetRecordId) {
      throw new Error("No pending verification record found for this handyman.");
    }

    if (status === "approved") {
      await apiClient.patch(`/admin/handymen/${targetRecordId}/approve`, "Approved by admin");
      return;
    }

    await apiClient.patch(`/admin/handymen/${targetRecordId}/reject`, "Rejected by admin");
  },

  async getBidTransactions(): Promise<BidTransactionItem[]> {
    const response = await apiClient.get<unknown>("/admin/bid-transactions");
    const rawRows = extractBidTransactionRows(response);

    if (rawRows.length === 0) {
      return [];
    }

    if (rawRows.some((row) => isRichBidTransactionRow(row))) {
      const mapped = rawRows
        .map((row) => toBidTransactionFromRichRow(row))
        .filter((row): row is BidTransactionItem => row !== null);
      return dedupeBidTransactions(mapped);
    }

    const events = rawRows
      .map((row) => toLedgerEvent(row))
      .filter((row): row is BidLedgerEvent => row !== null);

    if (events.length === 0) {
      return [];
    }

    const eventsByBid = new Map<string, BidLedgerEvent[]>();
    const uniqueJobIds = new Set<string>();

    events.forEach((event) => {
      uniqueJobIds.add(event.jobId);
      const existing = eventsByBid.get(event.bidId);
      if (existing) {
        existing.push(event);
      } else {
        eventsByBid.set(event.bidId, [event]);
      }
    });

    const [jobs, bidsByJob] = await Promise.all([
      fetchAdminJobsWithFallback({ page: 1, pageSize: 1000 }),
      Promise.all(
        Array.from(uniqueJobIds).map(async (jobId) => {
          try {
            const bidResponse = await bidsService.getBidsForJob(jobId, { page: 1, pageSize: 1000 });
            return [jobId, bidResponse.bids ?? []] as const;
          } catch {
            return [jobId, []] as const;
          }
        })
      ),
    ]);

    const jobsById = new Map<string, Job>();
    jobs.forEach((job) => {
      jobsById.set(job.id, job);
    });

    const bidsById = new Map<string, { jobId: string; bid: (typeof bidsByJob)[number][1][number] }>();
    bidsByJob.forEach(([jobId, bids]) => {
      bids.forEach((bid) => {
        bidsById.set(bid.id, { jobId, bid });
      });
    });

    const rows: BidTransactionItem[] = [];

    eventsByBid.forEach((bidEvents, bidId) => {
      const ordered = [...bidEvents].sort(
        (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)
      );
      const first = ordered[0];
      const latest = ordered[ordered.length - 1];

      let flagged = false;
      let locked = false;
      let inferredStatus: AdminBidStatus = "pending";
      let fallbackJobTitle = latest.jobTitle;
      let fallbackHomeownerName = latest.homeownerName;
      let fallbackHandymanName = latest.handymanName;
      let fallbackPrice = latest.price;
      let fallbackEmergency = latest.emergency;

      ordered.forEach((event) => {
        const status = statusFromEventType(event.eventType);
        if (status) inferredStatus = status;

        if (event.eventType === "flag_added") flagged = true;
        if (event.eventType === "flag_removed") flagged = false;
        if (event.eventType === "lock_added") locked = true;
        if (event.eventType === "lock_removed") locked = false;

        if (event.jobTitle) fallbackJobTitle = event.jobTitle;
        if (event.homeownerName) fallbackHomeownerName = event.homeownerName;
        if (event.handymanName) fallbackHandymanName = event.handymanName;
        if (typeof event.price === "number") fallbackPrice = event.price;
        if (typeof event.emergency === "boolean") fallbackEmergency = event.emergency;
      });

      const bidContext = bidsById.get(bidId);
      const bid = bidContext?.bid;
      const jobId = bid?.jobId ?? latest.jobId;
      const job = jobsById.get(jobId);

      rows.push({
        id: bidId,
        jobTitle:
          job?.title ??
          fallbackJobTitle ??
          (jobId ? `Job ${jobId.slice(0, 8)}` : "Unknown job"),
        homeownerName: job?.postedBy.name ?? fallbackHomeownerName ?? "Unknown homeowner",
        handymanName: bid?.handyman.name ?? fallbackHandymanName ?? "Unknown handyman",
        price: typeof bid?.price === "number" ? bid.price : fallbackPrice ?? 0,
        status: bid ? toAdminBidStatus(bid.status) : inferredStatus,
        emergency: job?.isEmergency ?? fallbackEmergency ?? false,
        createdAt: bid?.createdAt ?? first.createdAt,
        flagged,
        locked,
      });
    });

    return dedupeBidTransactions(rows);
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

  async getReports(status?: ReportStatus, page = 1, pageSize = 1000): Promise<UserReport[]> {
    const query = new URLSearchParams();
    
    if (status) query.set("status", status);
    query.set("page", page.toString());
    query.set("pageSize", pageSize.toString());

    const path = `/admin/report?${query.toString()}`;

    const response = await apiClient.get<ReportListResponse>(path);

    if (!response || !Array.isArray(response.data)) {
      return [];
    }

    return response.data.map((row) => toUserReport(row));
  },

  async resolveReport(reportId: string, notes: string): Promise<void> {
    await apiClient.patch<void>(`/admin/report/${reportId}/resolve`, notes);
  },

  async reviewReport(reportId: string, notes: string): Promise<void> {
    await apiClient.patch<void>(`/admin/report/${reportId}/review`, notes);
  },
};
