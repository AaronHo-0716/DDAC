using System;
using System.Collections.Generic;

namespace backend.Models.DTOs;

public enum UserRoleFilter { Handyman, Homeowner, Admin }
public enum VerificationStatus { Pending, Approved, Rejected }

public record UserSearchRequest(
    string? Name = null,
    string? Email = null,
    UserRoleFilter? Role = null,
    bool? IsActive = null,
    VerificationStatus? Verification = null,
    string? avatarUrl = null,
    int? rating = null,
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
    DateTime CreatedAtUtc
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
