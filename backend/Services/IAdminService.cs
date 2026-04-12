using backend.Models.DTOs;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace backend.Services;

public interface IAdminService
{
    Task<AdminOverviewResponse> GetOverviewAsync();
    Task<IEnumerable<UserDto>> GetAllUsers(UserSearchRequest request);
    Task<UserDto> GetUserByIdAsync(Guid id);
    Task<BlockedUserResponse?> UpdateUserBlockStatusAsync(Guid targetId, bool block, string? reason, Guid adminIdFromToken);
    Task<IEnumerable<HandymanVerificationDto>> GetPendingVerificationsAsync();
    Task VerifyHandymanAsync(Guid id, bool approve, string? notes, Guid adminId);
    Task<IEnumerable<JobDto>> GetEmergencyJobsAsync();
    Task AssignJobAsync(Guid jobId, Guid handymanUserId, Guid adminId);
    Task<IEnumerable<BidTransactionDto>> GetBidTransactionsAsync(string? eventType = null);
    Task<BidTransactionDto> GetBidTransactionByIdAsync(Guid id);
    Task HandleBidActionAsync(Guid bidId, string actionType, string reason, Guid adminId);
    Task<IEnumerable<AdminActionDto>> GetAuditLogsAsync();
    Task<IEnumerable<UserReportDto>> GetAllReportsAsync(ReportStatusFilter? status = null);
    Task ResolveReportAsync(Guid reportId, string adminNotes, Guid adminId);
    Task ReviewReportAsync(Guid reportId, Guid adminId);
}
