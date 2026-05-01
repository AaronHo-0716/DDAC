"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CircleDollarSign,
  ExternalLink,
  Upload,
  WalletCards,
  Edit2,
  X,
} from "lucide-react";
import { useRequireRole } from "@/app/lib/hooks/useRequireRole";
import {
  paymentsService,
  type BankDetails,
  type CreditBalance,
  type CreditTransaction,
  type PaymentTransaction,
  type WithdrawalRequest,
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
    earned: "border-emerald-200 bg-emerald-50 text-emerald-700",
    verified: "border-emerald-200 bg-emerald-50 text-emerald-700",
    disabled: "border-slate-200 bg-slate-50 text-slate-700",
    approved: "border-blue-200 bg-blue-50 text-blue-700",
    pending: "border-amber-200 bg-amber-50 text-amber-700",
    initiated: "border-amber-200 bg-amber-50 text-amber-700",
    unverified: "border-amber-200 bg-amber-50 text-amber-700",
    withdrawn: "border-slate-200 bg-slate-50 text-slate-700",
    rejected: "border-red-200 bg-red-50 text-red-700",
  };

  return `inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colors[status] ?? colors.pending}`;
}

interface BankDetailsModalProps {
  isOpen: boolean;
  title: string;
  submitText: string;
  onClose: () => void;
  onSubmit: (data: BankDetailsFormValues) => Promise<void>;
  isSubmitting: boolean;
  error: string | null;
}

interface BankDetailsFormValues {
  bankName: string;
  accountName: string;
  accountNumber: string;
  proofFile: File;
}

function BankDetailsModal({
  isOpen,
  title,
  submitText,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: BankDetailsModalProps) {
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const validateFile = (selectedFile: File) => {
    const extension = selectedFile.name.split(".").pop()?.toLowerCase();
    const allowedExtensions = ["png", "jpeg"];
    const allowedMimeTypes = ["image/png", "image/jpeg"];

    if (!allowedExtensions.includes(extension ?? "")) {
      setFileError("Only PNG and JPEG files are allowed.");
      setFile(null);
      return false;
    }

    if (!allowedMimeTypes.includes(selectedFile.type)) {
      setFileError("Only PNG and JPEG files are allowed.");
      setFile(null);
      return false;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setFileError("File size must be less than 5MB.");
      setFile(null);
      return false;
    }

    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) {
      setFile(null);
      setFileError(null);
      return;
    }

    if (!validateFile(selectedFile)) {
      return;
    }

    setFile(selectedFile);
    setFileError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedBankName = bankName.trim();
    const trimmedAccountName = accountName.trim();
    const trimmedAccountNumber = accountNumber.trim();

    if (!trimmedBankName || !trimmedAccountName || !trimmedAccountNumber) {
      setFileError(null);
      setFileError("Please fill in all bank detail fields.");
      return;
    }

    if (trimmedAccountNumber.length < 8 || trimmedAccountNumber.length > 20) {
      setFileError(null);
      setFileError("Account number must be between 8 and 20 digits.");
      return;
    }

    if (!file) {
      setFileError("Please select a PNG or JPEG file.");
      return;
    }

    await onSubmit({
      bankName: trimmedBankName,
      accountName: trimmedAccountName,
      accountNumber: trimmedAccountNumber,
      proofFile: file,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-2xl border border-[#E5E7EB] bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#111827]">{title}</h2>
            <p className="text-sm text-[#6B7280]">
              Add your bank details and proof image in one submission.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#F3F4F6] rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          {error && (
            <div className="md:col-span-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {fileError && (
            <div className="md:col-span-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {fileError}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-semibold text-[#111827]">
              Bank Name
            </label>
            <input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="e.g. Maybank"
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm outline-none transition focus:border-[#0B74FF]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-[#111827]">
              Account Holder Name
            </label>
            <input
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="e.g. Ahmad Bin Ali"
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm outline-none transition focus:border-[#0B74FF]"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-[#111827]">
              Account Number
            </label>
            <input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="e.g. 1234567890"
              inputMode="numeric"
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm outline-none transition focus:border-[#0B74FF]"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-[#111827]">
              Proof Image
            </label>
            <label className="mt-1 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#D1D5DB] px-3 py-6 text-sm text-[#6B7280] hover:border-[#9CA3AF]">
              <Upload className="h-5 w-5" />
              <span>{file ? file.name : "Click to upload PNG or JPEG"}</span>
              <span className="text-xs text-[#9CA3AF]">
                PNG or JPEG only, max 5MB
              </span>
              <input
                type="file"
                accept=".png,.jpeg,image/png,image/jpeg"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          <div className="md:col-span-2 flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-[#F9FAFB]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || isSubmitting}
              className="flex-1 rounded-xl bg-[#0B74FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#065ed1] disabled:opacity-60">
              {isSubmitting ? "Saving..." : submitText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function HandymanPaymentsPage() {
  const { authorized, loading } = useRequireRole("handyman");
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [credits, setCredits] = useState<CreditTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [fetching, setFetching] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const [bank, balanceData, paymentData, creditData, withdrawalData] =
        await Promise.all([
          paymentsService.getBankDetails(),
          paymentsService.getCreditBalance(),
          paymentsService.getPaymentTransactions(1, 100),
          paymentsService.getCreditTransactions(1, 100),
          paymentsService.getWithdrawalRequests(1, 100),
        ]);
      setBankDetails(bank);
      setBalance(balanceData);
      setPayments(paymentData.transactions ?? []);
      setCredits(creditData.transactions ?? []);
      setWithdrawals(withdrawalData.requests ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load payment workspace.",
      );
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (!authorized) return;
    void load();
  }, [authorized, load]);

  const paidPayments = useMemo(
    () => payments.filter((tx) => tx.status === "paid"),
    [payments],
  );

  const hasPendingWithdrawal = useMemo(
    () => withdrawals.some((request) => request.status === "pending"),
    [withdrawals],
  );

  if (loading || !authorized) return null;

  const handleSubmitBankDetails = async (data: BankDetailsFormValues) => {
    setSubmitting(true);
    setModalError(null);
    try {
      const createdBankDetails = await paymentsService.createBankDetails({
        bankName: data.bankName,
        accountName: data.accountName,
        accountNumber: data.accountNumber,
      });

      try {
        await paymentsService.uploadBankStatementProof(
          data.proofFile,
          createdBankDetails.id,
        );
      } catch (uploadErr) {
        await paymentsService.deleteBankDetails();
        throw uploadErr;
      }

      setModalOpen(false);
      setMessage(
        "New bank details submitted. If approved, this version will replace your current bank details; if rejected, your current details stay active.",
      );
      await load();
    } catch (err) {
      setModalError(
        err instanceof Error ? err.message : "Unable to save bank details.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const requestWithdrawal = async (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(withdrawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Withdrawal amount must be greater than zero.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await paymentsService.requestWithdrawal(Math.round(amount * 100) / 100);
      setWithdrawAmount("");
      setMessage("Withdrawal request submitted.");
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to request withdrawal.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">
              Payments and Payouts
            </h1>
            <p className="mt-0.5 text-sm text-[#6B7280]">
              Track credits, bank verification, and withdrawal requests.
            </p>
          </div>
          <Link
            href="/handyman/active-jobs"
            className="text-sm font-semibold text-[#0B74FF] hover:underline">
            Active jobs
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
              label: "Earned",
              value: money(balance?.earned ?? 0),
              icon: CircleDollarSign,
            },
            {
              label: "Available",
              value: money(balance?.available ?? 0),
              icon: WalletCards,
            },
            {
              label: "Pending withdrawal",
              value: money(balance?.pending ?? 0),
              icon: Banknote,
            },
            {
              label: "Paid out",
              value: money(balance?.withdrawn ?? 0),
              icon: Banknote,
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

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Bank Details Section */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-[#111827]">Bank Details</h2>
                <p className="text-sm text-[#6B7280]">
                  Submit a replacement bank detail without deleting the current
                  one.
                </p>
              </div>
            </div>

            {bankDetails ? (
              // Static Bank Details View
              <div className="space-y-3">
                <div className="rounded-xl bg-[#F9FAFB] p-3">
                  <p className="text-xs font-semibold text-[#6B7280]">
                    Bank Name
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#111827]">
                    {bankDetails.bankName}
                  </p>
                </div>
                <div className="rounded-xl bg-[#F9FAFB] p-3">
                  <p className="text-xs font-semibold text-[#6B7280]">
                    Account Holder Name
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#111827]">
                    {bankDetails.accountName}
                  </p>
                </div>
                <div className="rounded-xl bg-[#F9FAFB] p-3">
                  <p className="text-xs font-semibold text-[#6B7280]">
                    Account Number
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#111827]">
                    {bankDetails.accountNumber}
                  </p>
                </div>

                {bankDetails.bankStatementProofUrl && (
                  <div className="rounded-xl bg-[#F9FAFB] p-3">
                    <p className="text-xs font-semibold text-[#6B7280]">
                      Proof Document
                    </p>
                    <a
                      href={bankDetails.bankStatementProofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-[#0B74FF] hover:underline">
                      View proof <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}

                <div className="rounded-xl bg-[#F9FAFB] p-3">
                  <p className="text-xs font-semibold text-[#6B7280]">Status</p>
                  <span
                    className={`mt-1 ${badge(bankDetails.verificationStatus)}`}>
                    {bankDetails.verificationStatus}
                  </span>
                </div>

                {bankDetails.rejectionReason && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    <p className="font-semibold">Rejection Reason</p>
                    <p>{bankDetails.rejectionReason}</p>
                  </div>
                )}

                {bankDetails.verificationStatus === "disabled" && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    This bank detail was disabled after a newer approved bank
                    detail replaced it.
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setModalOpen(true)}
                    disabled={hasPendingWithdrawal}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#0B74FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#065ed1] disabled:opacity-50">
                    <Edit2 className="h-4 w-4" />
                    Change Bank Details
                  </button>
                </div>
                {hasPendingWithdrawal && (
                  <p className="text-xs text-[#6B7280]">
                    Bank details cannot be changed while a withdrawal request is
                    pending.
                  </p>
                )}
              </div>
            ) : (
              // No Bank Details - Show Create Button
              <button
                onClick={() => setModalOpen(true)}
                disabled={hasPendingWithdrawal}
                className="w-full rounded-xl bg-[#0B74FF] px-4 py-3 font-semibold text-white hover:bg-[#065ed1] disabled:opacity-50">
                Create Bank Details
              </button>
            )}
          </div>

          {/* Request Withdrawal Section */}
          <form
            onSubmit={requestWithdrawal}
            className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
            <h2 className="font-bold text-[#111827]">Request Withdrawal</h2>
            <p className="mt-1 text-sm text-[#6B7280]">
              Available balance: {money(balance?.available ?? 0)}
            </p>
            <div className="mt-4 flex gap-3">
              <input
                type="number"
                min="0"
                step="0.01"
                className="min-w-0 flex-1 rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm"
                placeholder="Amount"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
              <button
                disabled={
                  submitting || bankDetails?.verificationStatus !== "verified"
                }
                className="rounded-xl bg-[#111827] px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50">
                Request
              </button>
            </div>
            {bankDetails?.verificationStatus !== "verified" && (
              <p className="mt-3 text-xs text-[#6B7280]">
                Admin must verify your bank details first.
              </p>
            )}
          </form>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <HistoryTable
            title="Payment transactions"
            empty="No paid job payments yet."
            loading={fetching}>
            {paidPayments.map((tx) => (
              <tr key={tx.id}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-[#111827]">{tx.jobTitle}</p>
                  <p className="text-xs text-[#6B7280]">
                    {fmtDate(tx.updatedAtUtc)}
                  </p>
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  {money(tx.handymanCredit)}
                </td>
              </tr>
            ))}
          </HistoryTable>

          <HistoryTable
            title="Credit ledger"
            empty="No credit movements yet."
            loading={fetching}>
            {credits.map((tx) => (
              <tr key={tx.id}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-[#111827]">
                    {tx.description}
                  </p>
                  <span className={badge(tx.transactionType)}>
                    {tx.transactionType}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  {money(tx.amount)}
                </td>
              </tr>
            ))}
          </HistoryTable>

          <HistoryTable
            title="Withdrawals"
            empty="No withdrawal requests yet."
            loading={fetching}>
            {withdrawals.map((req) => (
              <tr key={req.id}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-[#111827]">
                    {fmtDate(req.requestedAtUtc)}
                  </p>
                  <span className={badge(req.status)}>{req.status}</span>
                  <p className="mt-2 text-xs text-[#6B7280]">
                    {req.bankDetails.bankName}
                    <br />
                    {req.bankDetails.accountName} |{" "}
                    {req.bankDetails.accountNumber}
                  </p>
                  {req.rejectionReason && (
                    <p className="mt-1 text-xs text-red-600">
                      {req.rejectionReason}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  {money(req.amount)}
                </td>
              </tr>
            ))}
          </HistoryTable>
        </div>
      </div>

      {/* Modals and Dialogs */}
      <BankDetailsModal
        key={modalOpen ? "bank-details-open" : "bank-details-closed"}
        isOpen={modalOpen}
        title={bankDetails ? "Submit New Bank Details" : "Create Bank Details"}
        submitText={
          bankDetails ? "Submit New Bank Details" : "Create Bank Details"
        }
        onClose={() => {
          setModalOpen(false);
          setModalError(null);
        }}
        onSubmit={handleSubmitBankDetails}
        isSubmitting={submitting}
        error={modalError}
      />
    </div>
  );
}

function HistoryTable({
  title,
  empty,
  loading,
  children,
}: {
  title: string;
  empty: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  const hasRows = Array.isArray(children)
    ? children.length > 0
    : Boolean(children);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
      <div className="border-b border-[#F3F4F6] px-4 py-3">
        <h2 className="text-sm font-bold text-[#111827]">{title}</h2>
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-[#F3F4F6]">{children}</tbody>
      </table>
      {loading && (
        <div className="p-6 text-center text-sm text-[#6B7280]">Loading...</div>
      )}
      {!loading && !hasRows && (
        <div className="p-6 text-center text-sm text-[#6B7280]">{empty}</div>
      )}
    </div>
  );
}
