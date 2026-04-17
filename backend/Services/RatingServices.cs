using backend.Models.DTOs;
using Microsoft.EntityFrameworkCore;
using System.Net;
using backend.Models.Entities;
using backend.Constants;

namespace backend.Services;

public class RatingService(ServiceDependencies deps) : BaseService(deps), IRatingService
{
    public async Task SubmitRatingAsync(Guid raterId, SubmitRatingRequest request)
    {
        var isVerifiedHandyman = await Context.Handyman_Verifications.AnyAsync(v => 
            v.User_Id == request.TargetUserId && 
            v.Status == VerificationStatus.Approved.ToDbString());

        if (!isVerifiedHandyman)
            throw new HttpRequestException("Handyman not found or is not currently verified to receive ratings.", null, HttpStatusCode.NotFound);

        if (raterId == request.TargetUserId)
            throw new HttpRequestException("You cannot rate yourself.", null, HttpStatusCode.BadRequest);

        if (request.Score < 1 || request.Score > 5)
            throw new HttpRequestException("Rating must be between 1 and 5.", null, HttpStatusCode.BadRequest);

        var hasCompletedJobTogether = await Context.Jobs.AnyAsync(j => 
            j.Posted_By_User_Id == raterId &&
            j.Status == JobStatus.Completed.ToDbString() &&
            Context.Bids.Any(b =>
                b.Job_Id == j.Id &&
                b.Handyman_User_Id == request.TargetUserId && 
                b.Status == BidStatus.Accepted.ToDbString()) 
        );

        if (!hasCompletedJobTogether)
            throw new HttpRequestException("Access Denied: You can only rate a handyman after they have successfully completed a job for you.", null, HttpStatusCode.Forbidden);

        var existingRating = await Context.User_Ratings
            .FirstOrDefaultAsync(r => r.RaterUserId == raterId && r.TargetUserId == request.TargetUserId);

        var RaterName = await Context.Users.FindAsync(raterId)
            ?? throw new HttpRequestException("User not found.", null, HttpStatusCode.NotFound);

        if (existingRating != null)
        {
            existingRating.Score = request.Score;
            existingRating.Comment = request.Comment;
            existingRating.UpdatedAtUtc = DateTime.UtcNow;
            await CreateNotification(request.TargetUserId, NotificationType.UpdateRating, $"{RaterName} updated their rating for you from {existingRating.Score} to {request.Score} stars.");
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
            await CreateNotification(request.TargetUserId, NotificationType.NewRating, $"You received a new {request.Score}-star rating from {RaterName}!");
        }

        await Context.SaveChangesAsync();
        
        await RecalculateUserAverageAsync(request.TargetUserId);
    }

    public async Task<UserRatingSummaryDto> GetUserRatingsAsync(Guid userId, int page = 1, int pageSize = 1000)
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

    public async Task<HandymanRatingListResponse> GetVerifiedHandymenReportAsync(HandymanRatingsFilter filter)
    {
        var query = Context.Handyman_Verifications
            .Include(v => v.User)
            .Where(v => v.Status == VerificationStatus.Approved.ToDbString());

        if (!string.IsNullOrWhiteSpace(filter.Name))
        {
            var searchName = filter.Name.ToLower().Trim();
            query = query.Where(v => v.User.Name.ToLower().Contains(searchName));
        }

        if (!string.IsNullOrWhiteSpace(filter.Email))
        {
            var searchEmail = filter.Email.ToLower().Trim();
            query = query.Where(v => v.User.Email.ToLower().Contains(searchEmail));
        }

        if (filter.MinRating.HasValue)
        {
            if (filter.MinRating.Value < 1 || filter.MinRating.Value > 5)
                throw new HttpRequestException("Minimum rating filter must be between 1 and 5.", null, HttpStatusCode.BadRequest);
            query = query.Where(v => v.User.Rating >= filter.MinRating.Value);
        }

        if (filter.MaxRating.HasValue)
        {
            if (filter.MaxRating.Value < 1 || filter.MaxRating.Value > 5)
                throw new HttpRequestException("Maximum rating filter must be between 1 and 5.", null, HttpStatusCode.BadRequest);
            query = query.Where(v => v.User.Rating <= filter.MaxRating.Value);
        }

        if (filter.MinRating.HasValue && filter.MaxRating.HasValue && filter.MinRating > filter.MaxRating)
            throw new HttpRequestException("Minimum rating filter cannot be greater than maximum rating filter.", null, HttpStatusCode.BadRequest);

        var totalCount = await query.CountAsync();

        var pagedData = await query
            .OrderByDescending(v => v.User.Rating)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .Select(v => new
            {
                Verification = v,
                User = v.User,
                TotalRatingsCount = Context.User_Ratings.Count(r => r.TargetUserId == v.User_Id),
                RecentRatings = Context.User_Ratings
                    .Include(r => r.RaterUser)
                    .Where(r => r.TargetUserId == v.User_Id)
                    .OrderByDescending(r => r.CreatedAtUtc)
                    .ToList()
            })
            .ToListAsync();

        var reportData = new List<HandymanRatingReportDto>();

        foreach (var item in pagedData)
        {
            var ratingDtos = item.RecentRatings.Select(r => new RatingDto(
                r.Id,
                r.RaterUserId,
                r.RaterUser.Name,
                GetPresignedUrl(r.RaterUser.AvatarUrl), 
                r.Score,
                r.Comment,
                r.CreatedAtUtc,
                r.UpdatedAtUtc
            )).ToList();

            var verDto = new HandymanVerificationDto(
                item.Verification.Id,
                item.Verification.User_Id,
                item.User.Name,
                item.Verification.Status,
                GetPresignedUrl(item.Verification.IdentityCardURL),
                GetPresignedUrl(item.Verification.SelfieImageURL), 
                item.Verification.Created_At_Utc,
                item.Verification.Updated_At_Utc
            );

            // Map Rating Summary
            var summaryDto = new UserRatingSummaryDto( item.User.Rating ?? 0, item.TotalRatingsCount, ratingDtos );

            reportData.Add(new HandymanRatingReportDto(verDto, summaryDto));
        }

        return new HandymanRatingListResponse(reportData, totalCount, filter.Page, filter.PageSize);
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
