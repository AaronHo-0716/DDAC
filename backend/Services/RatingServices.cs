using backend.Data;
using backend.Models.DTOs;
using Microsoft.EntityFrameworkCore;
using System.Net;
using Amazon.S3;
using backend.Models.Config;
using Microsoft.Extensions.Options;
using backend.Models.Entities;
using backend.Constants;

namespace backend.Services;

public class RatingService(
    NeighbourHelpDbContext context, 
    ILogger<RatingService> logger,
    IAmazonS3 s3,
    IOptions<StorageOptions> options) : BaseService(context, logger, s3, options), IRatingService
{
    public async Task SubmitRatingAsync(Guid raterId, SubmitRatingRequest request)
    {
        if (raterId == request.TargetUserId)
            throw new HttpRequestException("You cannot rate yourself.", null, HttpStatusCode.BadRequest);

        if (request.Score < 1 || request.Score > 5)
            throw new HttpRequestException("Rating must be between 1 and 5.", null, HttpStatusCode.BadRequest);

        var existingRating = await Context.User_Ratings
            .FirstOrDefaultAsync(r => r.RaterUserId == raterId && r.TargetUserId == request.TargetUserId);

        if (existingRating != null)
        {
            existingRating.Score = request.Score;
            existingRating.Comment = request.Comment;
            existingRating.UpdatedAtUtc = DateTime.UtcNow;
        }
        else
        {;
            Context.User_Ratings.Add(new User_Rating
                {
                    Id = Guid.NewGuid(),
                    RaterUserId = raterId,
                    TargetUserId = request.TargetUserId,
                    Score = request.Score,
                    Comment = request.Comment
                });
        }

        await Context.SaveChangesAsync();
        
        await RecalculateUserAverageAsync(request.TargetUserId);
    }

    public async Task<UserRatingSummaryDto> GetUserRatingsAsync(Guid userId, int page = 1, int pageSize = 10)
    {
        var targetUser = await Context.Users.FindAsync(userId)
            ?? throw new HttpRequestException("User not found.", null, HttpStatusCode.NotFound);

        var query = Context.User_Ratings
            .Include(r => r.RaterUser)
            .Where(r => r.TargetUserId == userId)
            .OrderByDescending(r => r.CreatedAtUtc);

        var totalCount = await query.CountAsync();
        var ratings = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        var dtos = ratings.Select(r => new RatingDto(
            r.Id,
            r.RaterUserId,
            r.RaterUser.Name,
            GetPresignedUrl(r.RaterUser.AvatarUrl),
            r.Score,
            r.Comment,
            r.CreatedAtUtc,
            r.UpdatedAtUtc
        )).ToList();

        return new UserRatingSummaryDto(
            targetUser.Rating ?? 0,
            totalCount,
            dtos
        );
    }

    public async Task<HandymanRatingListResponse> GetVerifiedHandymenReportAsync(int page = 1, int pageSize = 10)
    {
        // 1. Get all approved handyman verification records
        var query = Context.Handyman_Verifications
            .Include(v => v.User) // Join with Users table
            .Where(v => v.Status == VerificationStatus.Approved.ToDbString())
            .OrderByDescending(v => v.Reviewed_At_Utc);

        var totalCount = await query.CountAsync();
        
        var verifications = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var reportData = new List<HandymanRatingReportDto>();

        foreach (var ver in verifications)
        {
            // 2. Fetch recent ratings for this specific handyman
            var recentRatings = await Context.User_Ratings
                .Include(r => r.RaterUser)
                .Where(r => r.TargetUserId == ver.User_Id)
                .OrderByDescending(r => r.CreatedAtUtc)
                .ToListAsync();

            var ratingDtos = recentRatings.Select(r => new RatingDto(
                r.Id,
                r.RaterUserId,
                r.RaterUser.Name,
                GetPresignedUrl(r.RaterUser.AvatarUrl),
                r.Score,
                r.Comment,
                r.CreatedAtUtc,
                r.UpdatedAtUtc
            )).ToList();

            // 3. Count total ratings for this specific handyman
            var totalRatingsCount = await Context.User_Ratings
                .CountAsync(r => r.TargetUserId == ver.User_Id);

            // 4. Construct the HandymanVerificationDto
            var verDto = new HandymanVerificationDto(
                ver.Id,
                ver.User_Id,
                ver.User.Name,
                ver.Status,
                GetPresignedUrl(ver.IdentityCardURL),
                GetPresignedUrl(ver.SelfieImageURL),
                ver.Created_At_Utc,
                ver.Updated_At_Utc
            );

            // 5. Construct the Rating Summary
            var summaryDto = new UserRatingSummaryDto(
                AverageRating: ver.User.Rating ?? 0,
                TotalRatings: totalRatingsCount,
                RecentRatings: ratingDtos
            );

            reportData.Add(new HandymanRatingReportDto(verDto, summaryDto));
        }

        return new HandymanRatingListResponse(reportData, totalCount, page, pageSize);
    }

    private async Task RecalculateUserAverageAsync(Guid userId)
    {
        var ratings = await Context.User_Ratings
            .Where(r => r.TargetUserId == userId)
            .Select(r => r.Score)
            .ToListAsync();

        var user = await Context.Users.FindAsync(userId);
        if (user != null && ratings.Any())
        {
            user.Rating = (decimal)ratings.Average();
            await Context.SaveChangesAsync();
        }
    }
}
