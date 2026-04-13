import type { CreateReportRequest, ReportStatus, UserReport } from "@/app/types";
import { apiClient } from "./client";

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

interface RawCreateReportResponse {
  message?: string | null;
}

function normalizeReportStatus(value?: string | null): ReportStatus {
  const normalized = (value ?? "pending").toLowerCase();
  if (normalized === "reviewed") return "reviewed";
  if (normalized === "resolved") return "resolved";
  return "pending";
}

function normalizeReport(row: RawUserReportDto): UserReport {
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

export const reportsService = {
  async createReport(data: CreateReportRequest): Promise<string> {
    const response = await apiClient.post<RawCreateReportResponse>("/report", data);
    return response.message ?? "Report submitted successfully.";
  },

  async getMyReports(): Promise<UserReport[]> {
    const response = await apiClient.get<RawUserReportDto[]>("/report/me");
    if (!Array.isArray(response)) return [];
    return response.map(normalizeReport);
  },
};
