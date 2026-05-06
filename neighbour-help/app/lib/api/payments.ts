import { apiClient, type BlobResponse } from "./client";
import { uploadsService } from "./uploads";

interface RawCheckoutSessionResponse {
  checkoutUrl?: string | null;
  sessionId?: string | null;
}

export interface CheckoutSessionResponse {
  checkoutUrl: string;
  sessionId: string;
}

export type PaymentTransactionStatus = "initiated" | "paid";
export type BankVerificationStatus =
  | "unverified"
  | "verified"
  | "rejected"
  | "disabled";
export type CreditTransactionType = "earned" | "withdrawn";
export type WithdrawalStatus = "pending" | "approved" | "rejected" | "paid";

export interface PaymentTransaction {
  id: string;
  bidId: string;
  jobId: string;
  jobTitle: string;
  homeownerUserId: string;
  homeownerName: string;
  handymanUserId: string;
  handymanName: string;
  bidAmount: number;
  sstAmount: number;
  homeownerPlatformFee: number;
  handymanPlatformFee: number;
  homeownerTotal: number;
  handymanCredit: number;
  status: PaymentTransactionStatus;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface PaymentTransactionsResponse {
  transactions: PaymentTransaction[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface BankDetails {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  verificationStatus: BankVerificationStatus;
  bankStatementProofUrl?: string;
  rejectionReason?: string;
  verifiedAtUtc?: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface AdminBankDetails extends BankDetails {
  handymanUserId: string;
  handymanName: string;
  handymanEmail: string;
}

export interface AdminBankDetailsResponse {
  bankDetails: AdminBankDetails[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface CreditBalance {
  earned: number;
  withdrawn: number;
  available: number;
  pending: number;
}

export interface CreditTransaction {
  id: string;
  transactionType: CreditTransactionType;
  amount: number;
  description: string;
  relatedJobId?: string;
  relatedBidId?: string;
  relatedPaymentId?: string;
  relatedWithdrawalRequestId?: string;
  createdAtUtc: string;
}

export interface CreditTransactionsResponse {
  transactions: CreditTransaction[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface BankDetailsSnapshot {
  bankName: string;
  accountName: string;
  accountNumber: string;
}

export interface WithdrawalRequest {
  id: string;
  handymanUserId: string;
  handymanName: string;
  amount: number;
  status: WithdrawalStatus;
  requestedAtUtc: string;
  approvedAtUtc?: string;
  paidAtUtc?: string;
  rejectionReason?: string;
  bankTransferReference?: string;
  bankDetails: BankDetailsSnapshot;
}

export interface WithdrawalRequestsResponse {
  requests: WithdrawalRequest[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface WithdrawalStats {
  totalPending: number;
  totalApproved: number;
  totalPaid: number;
  countPending: number;
  countApproved: number;
  countPaid: number;
  countRejected: number;
}

export interface AdminPaymentStats {
  totalPlatformFeesEarned: number;
  todayPlatformFeesEarned: number;
  totalPaymentsProcessed: number;
  pendingBankApprovals: number;
  pendingWithdrawalRequests: number;
  pendingPaymentsForWithdrawal: number;
}

export const paymentsService = {
  async getPaymentTransactions(
    page = 1,
    pageSize = 50,
  ): Promise<PaymentTransactionsResponse> {
    return apiClient.get<PaymentTransactionsResponse>(
      `/payments/transactions?page=${page}&pageSize=${pageSize}`,
    );
  },

  async getReceiptPdf(paymentId: string): Promise<BlobResponse> {
    return apiClient.getBlob(`/payments/${paymentId}/receipt`);
  },

  async createCheckoutSession(jobId: string): Promise<CheckoutSessionResponse> {
    const response = await apiClient.post<RawCheckoutSessionResponse>(
      `/payments/jobs/${jobId}/checkout-session`,
      {},
    );

    const checkoutUrl = response.checkoutUrl ?? "";
    const sessionId = response.sessionId ?? "";

    if (!checkoutUrl || !sessionId) {
      throw new Error("Invalid payment session response from server.");
    }

    return {
      checkoutUrl,
      sessionId,
    };
  },

  async confirmCheckoutSession(
    jobId: string,
    sessionId: string,
  ): Promise<void> {
    await apiClient.post(
      `/payments/jobs/${jobId}/checkout-sessions/${encodeURIComponent(sessionId)}/confirm`,
      {},
    );
  },

  async getBankDetails(): Promise<BankDetails | null> {
    try {
      return await apiClient.get<BankDetails>("/bank-details");
    } catch (err) {
      if (
        err instanceof Error &&
        "statusCode" in err &&
        (err as { statusCode?: number }).statusCode === 404
      ) {
        return null;
      }
      throw err;
    }
  },

  async createBankDetails(data: {
    bankName: string;
    accountName: string;
    accountNumber: string;
  }): Promise<BankDetails> {
    return apiClient.post<BankDetails>("/bank-details", data);
  },

  async deleteBankDetails(): Promise<void> {
    await apiClient.delete("/bank-details");
  },

  async uploadBankStatementProof(
    file: File,
    bankDetailsId: string,
  ): Promise<BankDetails> {
    const response = await uploadsService.uploadBankStatementProof(
      file,
      bankDetailsId,
    );
    return response as BankDetails;
  },

  async getCreditBalance(): Promise<CreditBalance> {
    return apiClient.get<CreditBalance>("/bank-details/credits/balance");
  },

  async getCreditTransactions(
    page = 1,
    pageSize = 50,
  ): Promise<CreditTransactionsResponse> {
    return apiClient.get<CreditTransactionsResponse>(
      `/bank-details/credits/transactions?page=${page}&pageSize=${pageSize}`,
    );
  },

  async requestWithdrawal(amount: number): Promise<WithdrawalRequest> {
    return apiClient.post<WithdrawalRequest>(
      "/bank-details/withdrawals/request",
      { amount },
    );
  },

  async getWithdrawalRequests(
    page = 1,
    pageSize = 50,
  ): Promise<WithdrawalRequestsResponse> {
    return apiClient.get<WithdrawalRequestsResponse>(
      `/bank-details/withdrawals?page=${page}&pageSize=${pageSize}`,
    );
  },
};

export const adminPaymentsService = {
  async getBankDetails(
    status?: BankVerificationStatus | "all",
    page = 1,
    pageSize = 50,
  ): Promise<AdminBankDetailsResponse> {
    const query = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (status && status !== "all") query.set("status", status);
    return apiClient.get<AdminBankDetailsResponse>(
      `/admin/bank-details?${query.toString()}`,
    );
  },

  async approveBankDetails(bankDetailsId: string): Promise<AdminBankDetails> {
    return apiClient.patch<AdminBankDetails>(
      `/admin/bank-details/${bankDetailsId}/approve`,
      {},
    );
  },

  async rejectBankDetails(
    bankDetailsId: string,
    reason: string,
  ): Promise<AdminBankDetails> {
    return apiClient.patch<AdminBankDetails>(
      `/admin/bank-details/${bankDetailsId}/reject`,
      { reason },
    );
  },

  async getWithdrawals(
    status?: WithdrawalStatus | "all",
    page = 1,
    pageSize = 50,
  ): Promise<WithdrawalRequestsResponse> {
    const query = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (status && status !== "all") query.set("status", status);
    return apiClient.get<WithdrawalRequestsResponse>(
      `/admin/withdrawals?${query.toString()}`,
    );
  },

  async approveWithdrawal(
    requestId: string,
    notes?: string,
  ): Promise<WithdrawalRequest> {
    return apiClient.patch<WithdrawalRequest>(
      `/admin/withdrawals/${requestId}/approve`,
      { notes },
    );
  },

  async rejectWithdrawal(
    requestId: string,
    reason: string,
  ): Promise<WithdrawalRequest> {
    return apiClient.patch<WithdrawalRequest>(
      `/admin/withdrawals/${requestId}/reject`,
      { reason },
    );
  },

  async markWithdrawalPaid(
    requestId: string,
    bankTransferReference?: string,
  ): Promise<WithdrawalRequest> {
    return apiClient.patch<WithdrawalRequest>(
      `/admin/withdrawals/${requestId}/mark-paid`,
      {
        bankTransferReference,
      },
    );
  },

  async getWithdrawalStats(): Promise<WithdrawalStats> {
    return apiClient.get<WithdrawalStats>("/admin/withdrawals/stats");
  },

  async getPaymentStats(): Promise<AdminPaymentStats> {
    return apiClient.get<AdminPaymentStats>("/payments/admin/stats");
  },
};
