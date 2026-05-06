namespace backend.Models.DTOs;

public record CreateCheckoutSessionResponse(
    string CheckoutUrl,
    string SessionId
);

/// <summary>
/// Payment record returned after successful transaction
/// </summary>
public record PaymentDto(
    Guid Id,
    Guid BidId,
    Guid JobId,
    decimal BidAmount,
    decimal SstAmount,
    decimal HomeownerPlatformFee,
    decimal HandymanPlatformFee,
    decimal HomeownerTotal,
    decimal HandymanCredit,
    string Status,
    DateTime CreatedAtUtc
);

/// <summary>
/// Payment transaction row for homeowner, handyman, and admin history screens.
/// </summary>
public record PaymentTransactionDto(
    Guid Id,
    Guid BidId,
    Guid JobId,
    string JobTitle,
    Guid HomeownerUserId,
    string HomeownerName,
    Guid HandymanUserId,
    string HandymanName,
    decimal BidAmount,
    decimal SstAmount,
    decimal HomeownerPlatformFee,
    decimal HandymanPlatformFee,
    decimal HomeownerTotal,
    decimal HandymanCredit,
    string Status,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc
);

public record PaymentTransactionsResponse(
    List<PaymentTransactionDto> Transactions,
    int Page,
    int PageSize,
    int TotalCount
);

public record PaymentReceiptFile(
    byte[] Content,
    string FileName
);

/// <summary>
/// Handyman bank details for withdrawal requests
/// </summary>
public record BankDetailsDto(
    Guid Id,
    string BankName,
    string AccountName,
    string AccountNumber,
    string VerificationStatus,
    string? BankStatementProofUrl,
    string? RejectionReason,
    DateTime VerifiedAtUtc,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc
);

public record AdminBankDetailsDto(
    Guid Id,
    Guid HandymanUserId,
    string HandymanName,
    string HandymanEmail,
    string BankName,
    string AccountName,
    string AccountNumber,
    string VerificationStatus,
    string? BankStatementProofUrl,
    string? RejectionReason,
    DateTime? VerifiedAtUtc,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc
);

public record AdminBankDetailsResponse(
    List<AdminBankDetailsDto> BankDetails,
    int Page,
    int PageSize,
    int TotalCount
);

public record RejectBankDetailsRequest(
    string Reason
);

/// <summary>
/// Request to add or update bank details
/// </summary>
public record CreateBankDetailsRequest(
    string BankName,
    string AccountName,
    string AccountNumber
);

/// <summary>
/// Request to update bank details (when not verified)
/// </summary>
public record UpdateBankDetailsRequest(
    string BankName,
    string AccountName,
    string AccountNumber
);

/// <summary>
/// Handyman credit balance information
/// </summary>
public record CreditBalanceDto(
    decimal Earned,      // Total earned from completed jobs
    decimal Withdrawn,   // Total already withdrawn
    decimal Available,   // earned - withdrawn - pending
    decimal Pending      // Amount in pending withdrawal requests
);

/// <summary>
/// Individual credit transaction entry
/// </summary>
public record CreditTransactionDto(
    Guid Id,
    string TransactionType,  // 'earned' or 'withdrawn'
    decimal Amount,
    string Description,
    Guid? RelatedJobId,
    Guid? RelatedBidId,
    Guid? RelatedPaymentId,
    Guid? RelatedWithdrawalRequestId,
    DateTime CreatedAtUtc
);

/// <summary>
/// Response containing paginated credit transactions
/// </summary>
public record CreditTransactionsResponse(
    List<CreditTransactionDto> Transactions,
    int Page,
    int PageSize,
    int TotalCount
);

/// <summary>
/// Withdrawal request details
/// </summary>
public record WithdrawalRequestDto(
    Guid Id,
    Guid HandymanUserId,
    string HandymanName,
    decimal Amount,
    string Status,
    DateTime RequestedAtUtc,
    DateTime? ApprovedAtUtc,
    DateTime? PaidAtUtc,
    string? RejectionReason,
    string? BankTransferReference,
    BankDetailsSnapshotDto BankDetails
);

/// <summary>
/// Bank details snapshot (immutable record of bank info at withdrawal request time)
/// </summary>
public record BankDetailsSnapshotDto(
    string BankName,
    string AccountName,
    string AccountNumber
);

/// <summary>
/// Request to create a new withdrawal request
/// </summary>
public record CreateWithdrawalRequestRequest(
    decimal Amount
);

/// <summary>
/// Response containing paginated withdrawal requests
/// </summary>
public record WithdrawalRequestsResponse(
    List<WithdrawalRequestDto> Requests,
    int Page,
    int PageSize,
    int TotalCount
);

/// <summary>
/// Admin action: approve withdrawal request
/// </summary>
public record ApproveWithdrawalRequest(
    string? Notes = null  // Optional admin notes
);

/// <summary>
/// Admin action: reject withdrawal request
/// </summary>
public record RejectWithdrawalRequest(
    string Reason  // Mandatory reason for rejection
);

/// <summary>
/// Admin action: mark withdrawal as paid
/// </summary>
public record MarkWithdrawalPaidRequest(
    string? BankTransferReference = null  // Optional bank transfer reference/tracking ID
);

/// <summary>
/// Payment breakdown details (for display to homeowner during checkout)
/// </summary>
public record PaymentBreakdownDto(
    decimal BidAmount,
    decimal SstAmount,            // 6% of bid amount
    decimal HomeownerPlatformFee, // 3% of bid amount
    decimal HomeownerTotal,       // bid + SST + fee
    decimal HandymanCredit        // bid - handyman fee (3%)
);

/// <summary>
/// Admin dashboard payment statistics
/// </summary>
public record AdminPaymentStatsDto(
    decimal TotalPlatformFeesEarned,
    decimal TodayPlatformFeesEarned,
    int TotalPaymentsProcessed,
    int PendingBankApprovals,
    int PendingWithdrawalRequests,
    int PendingPaymentsForWithdrawal
);
