"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  XCircle,
} from "lucide-react";
import { useRequireRole } from "@/app/lib/hooks/useRequireRole";
import {
  adminPaymentsService,
  paymentsService,
  type AdminBankDetails,
  type BankVerificationStatus,
  type PaymentTransaction,
  type WithdrawalRequest,
  type WithdrawalStatus,
  type WithdrawalStats,
  type AdminPaymentStats,
} from "@/app/lib/api/payments";

function money(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(value);
}

function fmtDate(iso?: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-MY", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function badge(status: string) {
  const colors: Record<string, string> = {
    paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
    verified: "border-emerald-200 bg-emerald-50 text-emerald-700",
    disabled: "border-slate-200 bg-slate-50 text-slate-700",
    approved: "border-blue-200 bg-blue-50 text-blue-700",
    pending: "border-amber-200 bg-amber-50 text-amber-700",
    initiated: "border-amber-200 bg-amber-50 text-amber-700",
    unverified: "border-amber-200 bg-amber-50 text-amber-700",
    rejected: "border-red-200 bg-red-50 text-red-700",
  };

  return `inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colors[status] ?? colors.pending}`;
}

export default function AdminPaymentsPage() {
  const { authorized, loading } = useRequireRole("admin");
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [bankRows, setBankRows] = useState<AdminBankDetails[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [stats, setStats] = useState<WithdrawalStats | null>(null);
  const [paymentStats, setPaymentStats] = useState<AdminPaymentStats | null>(
    null,
  );
  const [fetching, setFetching] = useState(true);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [bankStatus, setBankStatus] = useState<BankVerificationStatus | "all">(
    "all",
  );
  const [withdrawalStatus, setWithdrawalStatus] = useState<
    WithdrawalStatus | "all"
  >("all");

  const load = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const [paymentData, bankData, withdrawalData, statData, paymentStatData] =
        await Promise.all([
          paymentsService.getPaymentTransactions(1, 100),
          adminPaymentsService.getBankDetails(bankStatus, 1, 100),
          adminPaymentsService.getWithdrawals(withdrawalStatus, 1, 100),
          adminPaymentsService.getWithdrawalStats(),
          adminPaymentsService.getPaymentStats(),
        ]);
      setPayments(paymentData.transactions ?? []);
      setBankRows(bankData.bankDetails ?? []);
      setWithdrawals(withdrawalData.requests ?? []);
      setStats(statData);
      setPaymentStats(paymentStatData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load admin payment workspace.",
      );
    } finally {
      setFetching(false);
    }
  }, [bankStatus, withdrawalStatus]);

  useEffect(() => {
    if (!authorized) return;
    void load();
  }, [authorized, load]);

  const paidTotal = useMemo(
    () =>
      payments
        .filter((tx) => tx.status === "paid")
        .reduce((sum, tx) => sum + tx.homeownerTotal, 0),
    [payments],
  );

  if (loading || !authorized) return null;

  const runAction = async (
    id: string,
    action: () => Promise<void>,
    success: string,
  ) => {
    setPendingActionId(id);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(success);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setPendingActionId(null);
    }
  };

  const rejectBank = async (row: AdminBankDetails) => {
    const reason = window.prompt("Reason for rejecting these bank details?");
    if (!reason?.trim()) return;
    await runAction(
      row.id,
      () =>
        adminPaymentsService
          .rejectBankDetails(row.id, reason)
          .then(() => undefined),
      "Bank details rejected.",
    );
  };

  const rejectWithdrawal = async (row: WithdrawalRequest) => {
    const reason = window.prompt("Reason for rejecting this withdrawal?");
    if (!reason?.trim()) return;
    await runAction(
      row.id,
      () =>
        adminPaymentsService
          .rejectWithdrawal(row.id, reason)
          .then(() => undefined),
      "Withdrawal rejected.",
    );
  };

  const markPaid = async (row: WithdrawalRequest) => {
    const reference =
      window.prompt("Bank transfer reference (optional)") ?? undefined;
    await runAction(
      row.id,
      () =>
        adminPaymentsService
          .markWithdrawalPaid(row.id, reference)
          .then(() => undefined),
      "Withdrawal marked as paid.",
    );
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">
              Admin Payments
            </h1>
            <p className="mt-0.5 text-sm text-[#6B7280]">
              Payment transactions, bank verification, and withdrawals.
            </p>
          </div>
          <Link
            href="/admin"
            className="text-sm font-semibold text-[#0B74FF] hover:underline">
            Back to Admin Dashboard
          </Link>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          {[
            {
              label: "Platform fees earned",
              value: money(paymentStats?.totalPlatformFeesEarned ?? 0),
              icon: CreditCard,
            },
            {
              label: "Today's fees",
              value: money(paymentStats?.todayPlatformFeesEarned ?? 0),
              icon: Banknote,
            },
            {
              label: "Pending bank approvals",
              value: String(paymentStats?.pendingBankApprovals ?? 0),
              icon: CheckCircle2,
            },
            {
              label: "Pending withdrawals",
              value: String(paymentStats?.pendingWithdrawalRequests ?? 0),
              icon: XCircle,
            },
          ].map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#0B74FF]">
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-xl font-bold text-[#111827]">{value}</p>
              <p className="text-sm text-[#6B7280]">{label}</p>
            </div>
          ))}
        </div>

        <Section
          title="All payment transactions"
          loading={fetching}
          empty={payments.length === 0}>
          <Table
            headers={[
              "Job",
              "Users",
              "Status",
              "Homeowner paid",
              "Handyman credit",
              "Date",
            ]}>
            {payments.map((tx) => (
              <tr key={tx.id}>
                <td className="px-4 py-3">
                  <Link
                    href={`/jobs/${tx.jobId}`}
                    className="font-semibold text-[#111827] hover:underline">
                    {tx.jobTitle}
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs text-[#6B7280]">
                  {tx.homeownerName} to {tx.handymanName}
                </td>
                <td className="px-4 py-3">
                  <span className={badge(tx.status)}>{tx.status}</span>
                </td>
                <td className="px-4 py-3 font-semibold">
                  {money(tx.homeownerTotal)}
                </td>
                <td className="px-4 py-3 font-semibold">
                  {money(tx.handymanCredit)}
                </td>
                <td className="px-4 py-3 text-xs text-[#6B7280]">
                  {fmtDate(tx.updatedAtUtc)}
                </td>
              </tr>
            ))}
          </Table>
        </Section>

        <Section
          title="Handyman bank details"
          loading={fetching}
          empty={bankRows.length === 0}
          action={
            <FilterSelect
              value={bankStatus}
              onChange={(value) =>
                setBankStatus(value as BankVerificationStatus | "all")
              }
              values={["all", "unverified", "verified", "rejected", "disabled"]}
            />
          }>
          <Table
            headers={[
              "Handyman",
              "Bank",
              "Status",
              "Proof",
              "Updated",
              "Actions",
            ]}>
            {bankRows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-[#111827]">
                    {row.handymanName}
                  </p>
                  <p className="text-xs text-[#6B7280]">{row.handymanEmail}</p>
                </td>
                <td className="px-4 py-3 text-xs text-[#374151]">
                  {row.bankName}
                  <br />
                  {row.accountName} | {row.accountNumber}
                </td>
                <td className="px-4 py-3">
                  <span className={badge(row.verificationStatus)}>
                    {row.verificationStatus}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {row.bankStatementProofUrl ? (
                    <a
                      href={row.bankStatementProofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B74FF] hover:underline">
                      Open <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <span className="text-xs text-[#9CA3AF]">No proof</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-[#6B7280]">
                  {fmtDate(row.updatedAtUtc)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={
                        pendingActionId === row.id ||
                        row.verificationStatus === "verified" ||
                        row.verificationStatus === "disabled"
                      }
                      onClick={() =>
                        void runAction(
                          row.id,
                          () =>
                            adminPaymentsService
                              .approveBankDetails(row.id)
                              .then(() => undefined),
                          "Bank details approved.",
                        )
                      }
                      className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
                      Approve
                    </button>
                    <button
                      disabled={
                        pendingActionId === row.id ||
                        row.verificationStatus === "verified" ||
                        row.verificationStatus === "disabled"
                      }
                      onClick={() => void rejectBank(row)}
                      className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </Section>

        <Section
          title="Withdrawal requests"
          loading={fetching}
          empty={withdrawals.length === 0}
          action={
            <FilterSelect
              value={withdrawalStatus}
              onChange={(value) =>
                setWithdrawalStatus(value as WithdrawalStatus | "all")
              }
              values={["all", "pending", "approved", "rejected", "paid"]}
            />
          }>
          <Table
            headers={[
              "Handyman",
              "Bank snapshot",
              "Status",
              "Amount",
              "Requested",
              "Actions",
            ]}>
            {withdrawals.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 font-semibold text-[#111827]">
                  {row.handymanName}
                </td>
                <td className="px-4 py-3 text-xs text-[#374151]">
                  {row.bankDetails.bankName}
                  <br />
                  {row.bankDetails.accountName} |{" "}
                  {row.bankDetails.accountNumber}
                </td>
                <td className="px-4 py-3">
                  <span className={badge(row.status)}>{row.status}</span>
                  {row.rejectionReason && (
                    <p className="mt-1 text-xs text-red-600">
                      {row.rejectionReason}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 font-semibold">{money(row.amount)}</td>
                <td className="px-4 py-3 text-xs text-[#6B7280]">
                  {fmtDate(row.requestedAtUtc)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={
                        pendingActionId === row.id || row.status !== "pending"
                      }
                      onClick={() =>
                        void runAction(
                          row.id,
                          () =>
                            adminPaymentsService
                              .approveWithdrawal(row.id)
                              .then(() => undefined),
                          "Withdrawal approved.",
                        )
                      }
                      className="rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50">
                      Approve
                    </button>
                    <button
                      disabled={
                        pendingActionId === row.id ||
                        !["pending", "approved"].includes(row.status)
                      }
                      onClick={() => void rejectWithdrawal(row)}
                      className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
                      Reject
                    </button>
                    <button
                      disabled={
                        pendingActionId === row.id || row.status !== "approved"
                      }
                      onClick={() => void markPaid(row)}
                      className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
                      Mark paid
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </Section>

        <p className="mt-4 inline-flex items-center gap-1 text-xs text-[#9CA3AF]">
          <XCircle className="h-3.5 w-3.5" />
          Admin actions are recorded in the backend audit log.
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  loading,
  empty,
  action,
}: {
  title: string;
  children: React.ReactNode;
  loading: boolean;
  empty: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F3F4F6] px-4 py-3">
        <h2 className="text-sm font-bold text-[#111827]">{title}</h2>
        {action}
      </div>
      {children}
      {loading && (
        <div className="p-8 text-center text-sm text-[#6B7280]">Loading...</div>
      )}
      {!loading && empty && (
        <div className="p-8 text-center text-sm text-[#6B7280]">
          No records in this view.
        </div>
      )}
    </div>
  );
}

function Table({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#F9FAFB] text-xs uppercase tracking-wide text-[#6B7280]">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 text-left">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F3F4F6]">{children}</tbody>
      </table>
    </div>
  );
}

function FilterSelect({
  value,
  values,
  onChange,
}: {
  value: string;
  values: string[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#374151]">
      {values.map((item) => (
        <option key={item} value={item}>
          {item}
        </option>
      ))}
    </select>
  );
}
