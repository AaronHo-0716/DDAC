using backend.Models.DTOs;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace backend.Services;

public interface IAdminService
{
    // Overview
    Task<AdminOverviewResponse> GetOverviewAsync();

    // User Management
    Task<IEnumerable<UserDto>> GetAllUsers(UserSearchRequest request);
    Task<UserDto> GetUserByIdAsync(Guid id);
    Task UpdateUserBlockStatusAsync(Guid id, bool block, string? reason, Guid adminId);

    // Handyman Verification
    Task<IEnumerable<HandymanVerificationDto>> GetPendingVerificationsAsync();
    Task VerifyHandymanAsync(Guid id, bool approve, string? notes, Guid adminId);

    // Job Management
    Task<IEnumerable<JobDto>> GetEmergencyJobsAsync();
    Task AssignJobAsync(Guid jobId, Guid handymanUserId, Guid adminId);

    // Bid & Transaction Management
    Task<IEnumerable<BidTransactionDto>> GetBidTransactionsAsync(string? eventType = null);
    Task<BidTransactionDto> GetBidTransactionByIdAsync(Guid id);
    Task HandleBidActionAsync(Guid bidId, string actionType, string reason, Guid adminId);

    // Audit & Notifications
    Task<IEnumerable<AdminActionDto>> GetAuditLogsAsync();
    Task MarkAllNotificationsReadAsync(Guid userId);
}
