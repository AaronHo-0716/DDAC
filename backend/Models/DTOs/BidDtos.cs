using backend.Constants;

namespace backend.Models.DTOs;

public record BidDto(
    Guid Id,
    Guid JobId,
    string JobName,
    UserDto Handyman,
    decimal Price,
    DateTime EstimatedArrival,
    string Message,
    string Status,
    bool IsRecommended,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record CreateBidRequest(
    decimal Price,
    DateTime EstimatedArrival,
    string Message
);

public record BidListResponse(
    List<BidDto> Bids,
    int Page,
    int PageSize,
    int TotalCount
);

public record BidFilterQuery(
    Guid JobId,
    int Page = 1,
    int PageSize = 10,
    BidStatus? Status = null
);
