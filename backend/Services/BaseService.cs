using backend.Data;
using backend.Models.DTOs;
using backend.Models.Entities;
using backend.Constants;
using Microsoft.EntityFrameworkCore;
using Npgsql.TypeMapping;

namespace backend.Services;

public abstract class BaseService(NeighbourHelpDbContext context, ILogger logger)
{
    protected readonly NeighbourHelpDbContext Context = context;
    protected readonly ILogger Logger = logger;

    protected static bool IsValidEmail(string email)
    {
        try { return new System.Net.Mail.MailAddress(email).Address == email; }
        catch { return false; }
    }
    protected UserDto MapUserToDto(User user, VerificationStatus? verificationStatus = null)
    {
        Enum.TryParse<UserRole>(user.Role, true, out var roleEnum);

        string? statusDbString = verificationStatus?.ToDbString();

        var finalVerification = AuthConstants.ParseVerification(statusDbString, user.Role);

        return new UserDto(
            user.Id,
            user.Name.Trim(),
            user.Email.Trim(),
            roleEnum.ToDbString(),
            user.AvatarUrl,
            user.Rating,
            user.CreatedAtUtc,
            user.IsActive,
            finalVerification.ToDbString(),
            user.Blocked_Reason,
            user.Blocked_At_Utc
        );
    }

    // Standard: One notification for one user
    protected void CreateNotification(Guid targetId, NotificationType type, string message, Guid? relatedJobId = null)
    {
        Context.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            User_Id = targetId,
            Type = type.ToDbString(),
            Message = message,
            Related_Job_Id = relatedJobId,
            Is_Read = false,
            Created_At_Utc = DateTime.UtcNow
        });
    }

    // Optimized: Same notification for many users (Admins, etc.)
    protected async Task CreateNotifications(NotificationType type, string message, UserRole targetRole = UserRole.Admin, Guid? relatedJobId = null)
    {
        var userIds = await Context.Users
            .Where(u => u.Role == targetRole.ToDbString())
            .Select(u => u.Id)
            .ToListAsync();

        var notifications = userIds.Select(userId => new Notification
        {
            Id = Guid.NewGuid(),
            User_Id = userId,
            Type = type.ToDbString(),
            Message = message,
            Related_Job_Id = relatedJobId,
            Is_Read = false,
            Created_At_Utc = DateTime.UtcNow
        });

        Context.Notifications.AddRange(notifications);
    }

    protected JobDto MapJobToDto(Job job)
    {
        var bidCount = context.Bids.Count(b => b.Job_Id == job.Id);

        if (!Enum.TryParse<UserRole>(job.Posted_By_User.Role, true, out var roleEnum))
            roleEnum = UserRole.Homeowner; 
            // Fallback to Homeowner if the role in DB is invalid or empty

        return new JobDto(
            Id: job.Id,
            Title: job.Title,
            Description: job.Description,
            Category: job.Category,
            Location: job.Location_Text,
            Latitude: job.Latitude,
            Longitude: job.Longitude,
            Budget: job.Budget,
            Status: JobConstants.ParseFromDb(job.Status).ToDbString(),
            IsEmergency: job.Is_Emergency,
            PostedBy: new UserDto(
                Id: job.Posted_By_User.Id,
                Name: job.Posted_By_User.Name,
                Email: job.Posted_By_User.Email,
                Role: roleEnum.ToDbString(), 
                AvatarUrl: job.Posted_By_User.AvatarUrl,
                Rating: job.Posted_By_User.Rating,
                CreatedAt: job.Posted_By_User.CreatedAtUtc,
                IsActive: true,
                Verification: VerificationStatus.Approved.ToDbString() 
            ),
            CreatedAt: job.Created_At_Utc,
            UpdatedAt: job.Updated_At_Utc,
            BidCount: bidCount,
            ImageUrls: job.Job_Images.OrderBy(img => img.Sort_Order).Select(img => img.Image_Url).ToList()
        );
    }

    protected BidDto MapBidToDto(Bid bid)
    {
        Enum.TryParse<UserRole>(bid.Handyman_User.Role, true, out var roleEnum);

        return new BidDto(
            Id: bid.Id,
            JobId: bid.Job_Id,
            Handyman: new UserDto(
                Id: bid.Handyman_User.Id,
                Name: bid.Handyman_User.Name,
                Email: bid.Handyman_User.Email,
                Role: roleEnum.ToDbString(), 
                AvatarUrl: bid.Handyman_User.AvatarUrl,
                Rating: bid.Handyman_User.Rating,
                CreatedAt: bid.Handyman_User.CreatedAtUtc,
                IsActive: bid.Handyman_User.IsActive,
                Verification: VerificationStatus.Approved.ToDbString()
            ),
            Price: bid.Price,
            EstimatedArrival: bid.Estimated_Arrival_Utc,
            Message: bid.Message,
            Status: BidConstants.ParseFromDb(bid.Status).ToDbString(),
            IsRecommended: bid.Is_Recommended,
            CreatedAt: bid.Created_At_Utc,
            UpdatedAt: bid.Updated_At_Utc
        );
    }
}