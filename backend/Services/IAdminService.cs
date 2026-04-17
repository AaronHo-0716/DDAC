using backend.Models.DTOs;

namespace backend.Services;

public interface IAdminService
{
    Task<AdminOverviewResponse> GetOverviewAsync();
    Task<UserDto> CreateAdminAsync(RegisterRequest request);
    Task<UserListResponse> GetAllUsers(UserSearchRequest request);
    Task<object> GetUserByIdAsync(Guid id, bool searchByHandyman = false);
    Task<UserDto> UpdateUserBlockStatusAsync(Guid targetId, bool block, string? reason, Guid adminIdFromToken);
    Task<HandymanVerificationListResponse> GetPendingVerificationsAsync(int page = 1, int pageSize = 1000);
    Task<HandymanVerificationDto> VerifyHandymanAsync(Guid id, bool approve, string? notes, Guid adminId);
    Task<IEnumerable<JobDto>> GetEmergencyJobsAsync();
    Task AssignJobAsync(Guid jobId, Guid handymanUserId, Guid adminId);
    Task<IEnumerable<BidDto>> GetBidTransactionsAsync(string? eventType = null);
    Task<BidTransactionDto> GetBidTransactionByIdAsync(Guid id);
    Task HandleBidActionAsync(Guid bidId, string actionType, string reason, Guid adminId);
    Task<IEnumerable<AdminActionDto>> GetAuditLogsAsync();
}
