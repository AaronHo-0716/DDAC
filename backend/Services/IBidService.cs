using backend.Models.DTOs;

namespace backend.Services;

public interface IBidService
{
    Task<BidListResponse> GetBidsByJobIdAsync(Guid jobId, int page = 1, int pageSize = 1000);

    Task<BidListResponse> GetMyBidsAsync(int page = 1, int pageSize = 1000);

    Task<BidDto> CreateBidAsync(Guid jobId, CreateBidRequest request);

    Task<BidDto> AcceptBidAsync(Guid bidId);

    Task<BidDto> RejectBidAsync(Guid bidId);

    Task DeleteBidAsync(Guid bidId);
}
