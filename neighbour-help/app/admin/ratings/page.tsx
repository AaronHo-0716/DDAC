"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MessageSquareText, Star, Users } from "lucide-react";
import { useRequireRole } from "@/app/lib/hooks/useRequireRole";
import {
  adminService,
  type AdminHandymanRatingItem,
} from "@/app/lib/api/admin";

function formatDate(iso?: string) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminRatingsPage() {
  const { authorized, loading } = useRequireRole("admin");
  const [rows, setRows] = useState<AdminHandymanRatingItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authorized) return;

    let cancelled = false;

    const load = async () => {
      setFetching(true);
      setError(null);
      try {
        const data = await adminService.getHandymanRatings();
        if (!cancelled) {
          setRows(
            data.sort((a, b) => {
              if (b.averageRating !== a.averageRating) {
                return b.averageRating - a.averageRating;
              }
              return b.totalRatings - a.totalRatings;
            })
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load ratings report.");
          setRows([]);
        }
      } finally {
        if (!cancelled) setFetching(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [authorized]);

  const totals = useMemo(() => {
    const rated = rows.filter((row) => row.totalRatings > 0);
    const overallAverage =
      rated.length > 0
        ? rated.reduce((sum, row) => sum + row.averageRating, 0) / rated.length
        : 0;

    return {
      totalHandymen: rows.length,
      ratedHandymen: rated.length,
      overallAverage,
    };
  }, [rows]);

  if (loading || !authorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">Handyman Ratings</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              Ratings submitted by homeowners for approved handymen.
            </p>
          </div>
          <Link href="/admin" className="text-sm font-semibold text-[#0B74FF] hover:underline">
            Back to Admin Dashboard
          </Link>
        </div>

        <div className="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
            <p className="text-xs text-[#6B7280] inline-flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Approved Handymen
            </p>
            <p className="text-xl font-bold text-[#111827]">{totals.totalHandymen}</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
            <p className="text-xs text-[#6B7280]">Handymen With Ratings</p>
            <p className="text-xl font-bold text-[#111827]">{totals.ratedHandymen}</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
            <p className="text-xs text-[#6B7280] inline-flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-amber-500" /> Average Score
            </p>
            <p className="text-xl font-bold text-[#111827]">{totals.overallAverage.toFixed(2)}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F9FAFB] text-xs uppercase tracking-wide text-[#6B7280]">
                <tr>
                  <th className="text-left px-4 py-3">Handyman</th>
                  <th className="text-left px-4 py-3">Average</th>
                  <th className="text-left px-4 py-3">Total Ratings</th>
                  <th className="text-left px-4 py-3">Latest Review</th>
                  <th className="text-left px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {rows.map((row) => {
                  const latest = row.reviews[0];
                  return (
                    <tr key={row.userId}>
                      <td className="px-4 py-3 align-top">
                        <p className="font-semibold text-[#111827]">{row.userName}</p>
                        <p className="text-xs text-[#6B7280]">{row.userId}</p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          {row.averageRating.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-[#111827] font-medium">{row.totalRatings}</td>
                      <td className="px-4 py-3 align-top">
                        {latest ? (
                          <div className="max-w-md">
                            <p className="text-xs font-semibold text-[#111827] inline-flex items-center gap-1">
                              <MessageSquareText className="h-3.5 w-3.5 text-[#6B7280]" />
                              {latest.raterName} rated {latest.score}/5
                            </p>
                            <p className="text-xs text-[#6B7280] mt-1 whitespace-pre-wrap">
                              {latest.comment || "No comment."}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-[#9CA3AF]">No reviews yet.</p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-[#6B7280]">
                        {latest ? formatDate(latest.updatedAtUtc) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {fetching && (
            <div className="p-8 text-center text-sm text-[#6B7280]">Loading ratings report...</div>
          )}

          {!fetching && rows.length === 0 && (
            <div className="p-8 text-center text-sm text-[#6B7280]">
              No approved handyman ratings found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
