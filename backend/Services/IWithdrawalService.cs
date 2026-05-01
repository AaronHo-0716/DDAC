using backend.Models.DTOs;

namespace backend.Services;

public interface IWithdrawalService
{
    /// <summary>
    /// Get all withdrawal requests (admin only)
    /// </summary>
    Task<WithdrawalRequestsResponse> GetAllWithdrawalRequestsAsync(string? status = null, int page = 1, int pageSize = 50);

    /// <summary>
    /// Get a specific withdrawal request by ID (admin only)
    /// </summary>
    Task<WithdrawalRequestDto> GetWithdrawalRequestByIdAsync(Guid requestId);

    /// <summary>
    /// Approve a withdrawal request (admin only)
    /// </summary>
    Task<WithdrawalRequestDto> ApproveWithdrawalAsync(Guid requestId, ApproveWithdrawalRequest? request = null);

    /// <summary>
    /// Reject a withdrawal request (admin only)
    /// </summary>
    Task<WithdrawalRequestDto> RejectWithdrawalAsync(Guid requestId, RejectWithdrawalRequest request);

    /// <summary>
    /// Mark a withdrawal request as paid (admin only)
    /// </summary>
    Task<WithdrawalRequestDto> MarkWithdrawalPaidAsync(Guid requestId, MarkWithdrawalPaidRequest? request = null);

    /// <summary>
    /// Get withdrawal request statistics (admin only)
    /// </summary>
    Task<WithdrawalStats> GetWithdrawalStatsAsync();
}

/// <summary>
/// Statistics for withdrawal requests
/// </summary>
public record WithdrawalStats(
    decimal TotalPending,
    decimal TotalApproved,
    decimal TotalPaid,
    int CountPending,
    int CountApproved,
    int CountPaid,
    int CountRejected
);
