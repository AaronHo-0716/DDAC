namespace backend.Models.DTOs;

public record SubmitRatingRequest(
    Guid TargetUserId, 
    int Score, 
    string? Comment
);

public record RatingDto(
    Guid Id,
    Guid RaterId,
    string RaterName,
    string? RaterAvatarUrl,
    int Score,
    string? Comment,
    DateTime CreatedAtUtc,
    DateTime UpdateAtUtc
);

public record UserRatingSummaryDto(
    decimal AverageRating,
    int TotalRatings,
    List<RatingDto> Ratings
);

public record HandymanRatingReportDto(
    HandymanVerificationDto Verification,
    UserRatingSummaryDto Rating
);

public record HandymanRatingListResponse(
    List<HandymanRatingReportDto> Data,
    int TotalCount,
    int Page,
    int PageSize
);

public record HandymanRatingsFilter(
    string? Name = null,
    string? Email = null,
    decimal? MinRating = null,
    decimal? MaxRating = null,
    int Page = 1,
    int PageSize = 1000
);