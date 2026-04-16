using backend.Models.DTOs;

public interface IRatingService
{
    Task SubmitRatingAsync(Guid raterId, SubmitRatingRequest request);
    Task<UserRatingSummaryDto> GetUserRatingsAsync(Guid userId, int page = 1, int pageSize = 10);
}
