using backend.Models.DTOs;

namespace backend.Services;

public interface IBidService
{
    Task<BidListResponse> GetBidsByJobIdAsync(Guid jobId, int page = 1, int pageSize = 10);

    Task<BidListResponse> GetMyBidsAsync(Guid userId, int page = 1, int pageSize = 10);

    Task<BidDto> CreateBidAsync(Guid jobId, CreateBidRequest request, Guid userId);

    Task<BidDto> AcceptBidAsync(Guid bidId, Guid userId, string userRole);

    Task<BidDto> RejectBidAsync(Guid bidId, Guid userId, string userRole);

    Task DeleteBidAsync(Guid bidId, Guid userId);
}
