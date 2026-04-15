using backend.Data;
using backend.Models.DTOs;
using backend.Models.Entities;
using backend.Constants;
using Microsoft.EntityFrameworkCore;
using Amazon.S3.Model;
using backend.Models.Config;
using Amazon.S3;
using Microsoft.Extensions.Options;

namespace backend.Services;

public abstract class BaseService
{
    protected readonly NeighbourHelpDbContext Context;
    protected readonly ILogger Logger;
    protected readonly IAmazonS3? S3Client;
    protected readonly S3StorageOptions? StorageOptions;

    protected BaseService( NeighbourHelpDbContext context, ILogger logger, IAmazonS3? s3Client = null, IOptions<StorageOptions>? storageOptions = null)
    {
        Context = context;
        Logger = logger;
        S3Client = s3Client;
        StorageOptions = storageOptions?.Value?.S3; 
    }

    protected static bool IsValidEmail(string email)
    {
        try { return new System.Net.Mail.MailAddress(email).Address == email; }
        catch { return false; }
    }

    protected string GetPresignedUrl(string? objectKey, int expiryMinutes = 60)
    {
        if (string.IsNullOrEmpty(objectKey) || S3Client == null || StorageOptions == null) 
            return null!;

        var request = new GetPreSignedUrlRequest
        {
            BucketName = StorageOptions.BucketName,
            Key = objectKey,
            Expires = DateTime.UtcNow.AddMinutes(expiryMinutes)
        };

        return S3Client.GetPreSignedURL(request);
    }

    protected async Task<UserDto> MapUserToDto(User user, string? statusOverride = null)
    {
        if (!Enum.TryParse<UserRole>(user.Role, true, out var roleEnum))
        {
            roleEnum = UserRole.Homeowner;
        }

        // Use the override if provided, otherwise fetch from DB
        string? verificationStatus = statusOverride;

        // ONLY query the database if we don't have an override and the user is a handyman
        if (verificationStatus == null && roleEnum == UserRole.Handyman)
        {
            verificationStatus = await Context.Handyman_Verifications
                .Where(v => v.User_Id == user.Id)
                .Select(v => v.Status)
                .FirstOrDefaultAsync();
        }

        var finalVerification = AuthConstants.ParseVerification(verificationStatus, user.Role);

        return new UserDto(
            user.Id,
            user.Name.Trim(),
            user.Email.Trim(),
            roleEnum.ToDbString(),
            GetPresignedUrl(user.AvatarUrl),
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
        var bidCount = Context.Bids.Count(b => b.Job_Id == job.Id);

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
                AvatarUrl: GetPresignedUrl(job.Posted_By_User.AvatarUrl),
                Rating: job.Posted_By_User.Rating,
                CreatedAt: job.Posted_By_User.CreatedAtUtc,
                IsActive: true,
                Verification: VerificationStatus.Approved.ToDbString() 
            ),
            CreatedAt: job.Created_At_Utc,
            UpdatedAt: job.Updated_At_Utc,
            BidCount: bidCount,
            ImageUrls: job.Job_Images.OrderBy(img => img.Sort_Order).Select(img => GetPresignedUrl(img.Object_Key)).ToList()
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
                AvatarUrl: GetPresignedUrl(bid.Handyman_User.AvatarUrl),
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

    protected HandymanVerificationDto MapPendingToDto(Handyman_Verification handyman)
    {
        return new HandymanVerificationDto(
                handyman.Id, 
                handyman.User_Id, 
                handyman.User.Name, 
                handyman.Status, 
                handyman.IdentityCardURL, 
                handyman.SelfieImageURL,
                handyman.Created_At_Utc,
                handyman.Updated_At_Utc
        );
    }
}
