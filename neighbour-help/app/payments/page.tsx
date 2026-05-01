"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CreditCard, ExternalLink, ReceiptText } from "lucide-react";
import { useRequireRole } from "@/app/lib/hooks/useRequireRole";
import { paymentsService, type PaymentTransaction } from "@/app/lib/api/payments";

function money(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(value);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-MY", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusClass(status: string) {
  return status === "paid"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
}

export default function HomeownerPaymentsPage() {
  const { authorized, loading } = useRequireRole("homeowner");
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authorized) return;

    let cancelled = false;
    const load = async () => {
      setFetching(true);
      setError(null);
      try {
        const response = await paymentsService.getPaymentTransactions(1, 100);
        if (!cancelled) setTransactions(response.transactions ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load payment history.");
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
    const paid = transactions.filter((tx) => tx.status === "paid");
    return {
      paidCount: paid.length,
      totalPaid: paid.reduce((sum, tx) => sum + tx.homeownerTotal, 0),
      fees: paid.reduce((sum, tx) => sum + tx.sstAmount + tx.homeownerPlatformFee, 0),
    };
  }, [transactions]);

  if (loading || !authorized) return null;

  return (
    <div className="min-h-screen bg-[#F7F8FA] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">Payment History</h1>
            <p className="mt-0.5 text-sm text-[#6B7280]">Completed and in-progress job payments.</p>
          </div>
          <Link href="/my-jobs" className="text-sm font-semibold text-[#0B74FF] hover:underline">
            View my jobs
          </Link>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { label: "Paid transactions", value: String(totals.paidCount), icon: ReceiptText },
            { label: "Total paid", value: money(totals.totalPaid), icon: CreditCard },
            { label: "Taxes and fees", value: money(totals.fees), icon: ReceiptText },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#0B74FF]">
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-2xl font-bold text-[#111827]">{value}</p>
              <p className="text-sm text-[#6B7280]">{label}</p>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F9FAFB] text-xs uppercase tracking-wide text-[#6B7280]">
                <tr>
                  <th className="px-4 py-3 text-left">Job</th>
                  <th className="px-4 py-3 text-left">Handyman</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Total</th>
                  <th className="px-4 py-3 text-left">Paid/Updated</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#111827]">{tx.jobTitle}</p>
                      <p className="text-xs text-[#6B7280]">Bid {money(tx.bidAmount)}</p>
                    </td>
                    <td className="px-4 py-3 text-[#374151]">{tx.handymanName}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusClass(tx.status)}`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#111827]">{money(tx.homeownerTotal)}</td>
                    <td className="px-4 py-3 text-xs text-[#6B7280]">{fmtDate(tx.updatedAtUtc)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/jobs/${tx.jobId}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B74FF] hover:underline"
                      >
                        Open job <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {fetching && <div className="p-8 text-center text-sm text-[#6B7280]">Loading transactions...</div>}
          {!fetching && transactions.length === 0 && (
            <div className="p-8 text-center text-sm text-[#6B7280]">No payment transactions yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
