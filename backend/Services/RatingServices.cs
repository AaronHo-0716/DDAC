using backend.Data;
using backend.Models.DTOs;
using Microsoft.EntityFrameworkCore;
using System.Net;
using Amazon.S3;
using backend.Models.Config;
using Microsoft.Extensions.Options;
using backend.Models.Entities;

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