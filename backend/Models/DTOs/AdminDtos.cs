using backend.Constants;

namespace backend.Models.DTOs;

public record UserSearchRequest(
    string? Name = null,
    string? Email = null,
    UserRole? Role = null,
    bool? IsActive = null,
    VerificationStatus? Verification = null,
    int Page = 1,
    int PageSize = 10
);

public record AdminOverviewResponse(
    int UsersCreatedToday,
    int JobsPostedToday,
    int BidsCreatedToday,
    int OpenEmergencies,
    int BlockedAccountCount
);

public record BlockUserRequest(string Reason);

public record AdminActionDto(
    Guid Id,
    Guid AdminUserId,
    string ActionType,
    string TargetType,
    Guid TargetId,
    string? Reason,
    DateTime CreatedAtUtc
);

public record HandymanVerificationDto(
    Guid Id,
    Guid UserId,
    string UserName,
    string Status,
    string? IdentityCardURL,
    string? SelfieImageUrl,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc
);

public record AssignJobRequest(Guid HandymanUserId);

public record BidTransactionDto(
    Guid Id,
    Guid BidId,
    Guid JobId,
    string EventType,
    string? EventReason,
    DateTime CreatedAtUtc
);
