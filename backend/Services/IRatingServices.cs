using backend.Models.DTOs;

public interface IRatingService
{
    Task SubmitRatingAsync(SubmitRatingRequest request);
    Task<UserRatingSummaryDto> GetUserRatingsAsync(int page = 1, int pageSize = 1000, Guid? userId = null);
    Task<HandymanRatingListResponse> GetVerifiedHandymenReportAsync(HandymanRatingsFilter filter);
}
