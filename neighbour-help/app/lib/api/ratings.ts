import { apiClient } from "./client";

export interface SubmitRatingRequest {
  targetUserId: string;
  score: number;
  comment?: string;
}

export interface UserRatingItem {
  id: string;
  raterId: string;
  raterName: string;
  raterAvatarUrl?: string;
  score: number;
  comment?: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface UserRatingSummary {
  averageRating: number;
  totalRatings: number;
  ratings: UserRatingItem[];
}

interface RawRatingItem {
  id?: string | null;
  raterId?: string | null;
  raterName?: string | null;
  raterAvatarUrl?: string | null;
  score?: number | null;
  comment?: string | null;
  createdAtUtc?: string | null;
  updateAtUtc?: string | null;
  updatedAtUtc?: string | null;
}

interface RawUserRatingSummary {
  averageRating?: number | null;
  totalRatings?: number | null;
  ratings?: RawRatingItem[] | null;
}

function normalizeRatingItem(item: RawRatingItem): UserRatingItem {
  return {
    id: item.id ?? "",
    raterId: item.raterId ?? "",
    raterName: item.raterName ?? "Unknown user",
    raterAvatarUrl: item.raterAvatarUrl ?? undefined,
    score: typeof item.score === "number" ? item.score : 0,
    comment: item.comment ?? undefined,
    createdAtUtc: item.createdAtUtc ?? new Date(0).toISOString(),
    updatedAtUtc:
      item.updatedAtUtc ?? item.updateAtUtc ?? item.createdAtUtc ?? new Date(0).toISOString(),
  };
}

function normalizeSummary(payload: RawUserRatingSummary): UserRatingSummary {
  const ratings = Array.isArray(payload.ratings)
    ? payload.ratings.map((entry) => normalizeRatingItem(entry))
    : [];

  return {
    averageRating: typeof payload.averageRating === "number" ? payload.averageRating : 0,
    totalRatings: typeof payload.totalRatings === "number" ? payload.totalRatings : ratings.length,
    ratings,
  };
}

export const ratingsService = {
  async submitRating(payload: SubmitRatingRequest): Promise<void> {
    await apiClient.post<{ message?: string }>("/ratings", payload);
  },

  async getMyRatings(page = 1, pageSize = 1000): Promise<UserRatingSummary> {
    const response = await apiClient.get<RawUserRatingSummary>(
      `/ratings/my?page=${page}&pageSize=${pageSize}`
    );
    return normalizeSummary(response);
  },

  async getRatingsByUserId(userId: string, page = 1, pageSize = 1000): Promise<UserRatingSummary> {
    const response = await apiClient.get<RawUserRatingSummary>(
      `/ratings/${userId}?page=${page}&pageSize=${pageSize}`
    );
    return normalizeSummary(response);
  },
};
