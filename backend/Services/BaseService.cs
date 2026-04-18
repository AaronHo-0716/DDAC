using backend.Data;
using backend.Models.DTOs;
using backend.Models.Entities;
using backend.Constants;
using Microsoft.EntityFrameworkCore;
using Amazon.S3.Model;
using backend.Models.Config;
using Amazon.S3;
using Microsoft.Extensions.Options;
using backend.Hubs;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
using System.Net;

namespace backend.Services;

public record ServiceDependencies(
    NeighbourHelpDbContext Context,
    ILoggerFactory LoggerFactory,
    IHttpContextAccessor HttpContextAccessor,
    IAmazonS3 S3Client,
    IOptions<StorageOptions> StorageOptions,
    IHubContext<NotificationHub> NotificationHub,
    IHubContext<ChatHub> ChatHub
);

public abstract class BaseService
{
    protected readonly NeighbourHelpDbContext Context;
    protected readonly ILogger Logger;
    protected readonly IAmazonS3 S3Client;
    protected readonly S3StorageOptions StorageOptions;
    protected readonly IHubContext<NotificationHub> NotificationHubContext;
    protected readonly IHubContext<ChatHub> ChatHubContext;
    protected readonly IHttpContextAccessor HttpContextAccessor;

    protected BaseService(ServiceDependencies deps)
    {
        Context = deps.Context;
        Logger = deps.LoggerFactory.CreateLogger(GetType()); 
        HttpContextAccessor = deps.HttpContextAccessor;
        S3Client = deps.S3Client;
        StorageOptions = deps.StorageOptions.Value.S3;
        NotificationHubContext = deps.NotificationHub;
        ChatHubContext = deps.ChatHub;
    }
    
    protected static bool IsValidEmail(string email)
    {
        try { return new System.Net.Mail.MailAddress(email).Address == email; }
        catch { return false; }
    }

    protected string GetPresignedUrl(string? objectKey, int expiryMinutes = 60)
    {
        if (string.IsNullOrWhiteSpace(objectKey))
            return null!;

        if (objectKey.StartsWith("http")) return objectKey;

        if (S3Client == null || StorageOptions == null || string.IsNullOrWhiteSpace(StorageOptions.BucketName))
            return null!;

        try
        {
            var request = new GetPreSignedUrlRequest
            {
                BucketName = StorageOptions.BucketName,
                Key = objectKey,
                Expires = DateTime.UtcNow.AddMinutes(expiryMinutes)
            };

            string url = S3Client.GetPreSignedURL(request);

            if (!string.IsNullOrWhiteSpace(StorageOptions.PublicBaseUrl))
            {
                var internalUri = new Uri(url);
                var publicUri = new Uri(StorageOptions.PublicBaseUrl);
                var builder = new UriBuilder(internalUri)
                {
                    Scheme = publicUri.Scheme, Host = publicUri.Host, Port = publicUri.Port
                };
                url = builder.ToString();
            }
            return url;
        }
        catch (Exception ex)
        {
            Logger.LogWarning(ex, "Unable to generate presigned URL for object key {ObjectKey}", objectKey);
            return null!;
        }
    }

    protected async Task<UserDto> MapUserToDto(User user, string? statusOverride = null)
    {
        Enum.TryParse<UserRole>(user.Role, true, out var roleEnum);

        string? verificationStatus = statusOverride;
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
            (user.Name ?? string.Empty).Trim(),
            (user.Email ?? string.Empty).Trim(),
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

    protected async Task CreateNotification(Guid targetId, NotificationType type, string message, Guid? relatedJobId = null)
    {
        var n = new Notification
        {
            Id = Guid.NewGuid(),
            User_Id = targetId,
            Type = type.ToDbString(),
            Message = message,
            Related_Job_Id = relatedJobId,
            Is_Read = false,
            Created_At_Utc = DateTime.UtcNow
        };
        Context.Notifications.Add(n);

        await NotificationHubContext.Clients
            .Group($"{ClientGroupType.Notify_}{targetId}")
            .SendAsync(HubMethod.ReceiveNotification.ToString(), MapNotificationToDto(n));
    }

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
        }).ToList();

        Context.Notifications.AddRange(notifications);

        var broadcastDto = new NotificationDto(
            Id: Guid.Empty, 
            Type: type.ToDbString(),
            Message: message,
            RelatedJobId: relatedJobId,
            IsRead: false,
            CreatedAtUtc: DateTime.UtcNow
        );

        await NotificationHubContext.Clients
            .Group($"{ClientGroupType.Notify_}{targetRole}")
            .SendAsync(HubMethod.ReceiveNotification.ToString(), broadcastDto);
    }

    protected MessageDto MapMessageToDto(Message m) => new(
        m.Id, 
        m.Sender_User_Id, 
        Enum.Parse<MessageType>(m.Message_Type, true),
        m.Message_Type == MessageType.Image.ToDbString() ? GetPresignedUrl(m.Body_Text) : m.Body_Text,
        m.Created_At_Utc
    );

    protected NotificationDto MapNotificationToDto(Notification entity)
    {
        return new NotificationDto(
            entity.Id,
            entity.Type,
            entity.Message,
            entity.Related_Job_Id,
            entity.Is_Read,
            entity.Created_At_Utc
        );
    }

    protected string GetCurrentUserRole()
    {
        var user = HttpContextAccessor?.HttpContext?.User;
        return user?.FindFirstValue(ClaimTypes.Role) ?? 
            throw new HttpRequestException("Unauthorized: invalid authentication token.", null, HttpStatusCode.Unauthorized);
    }

    protected async Task<Guid> GetCurrentUserIdAsync()
    {
        // 1. Access the User from the current HttpContext
        var user = HttpContextAccessor?.HttpContext?.User;
        var email = user?.FindFirstValue(ClaimTypes.Email) ?? 
            throw new HttpRequestException("Unauthorized: No valid email claim found in token.", null, HttpStatusCode.Unauthorized);

        // 2. Use the Context already provided to the class
        return await Context.Users
            .AsNoTracking()
            .Where(u => u.Email == email.ToLower().Trim())
            .Select(u => u.Id)
            .FirstOrDefaultAsync();
    }
    
    protected async Task<JobDto> MapJobToDto(Job job)
    {
        var currentUserRole = GetCurrentUserRole();
        var isAdmin = string.Equals(currentUserRole, UserRole.Admin.ToDbString(), StringComparison.OrdinalIgnoreCase);
        var bidCount = isAdmin
            ? await Context.Bids.CountAsync(b => b.Job_Id == job.Id)
            : await Context.Bids.CountAsync(b => b.Job_Id == job.Id && !b.Locked);

        if (!Enum.TryParse<UserRole>(job.Posted_By_User?.Role, true, out var roleEnum))
            roleEnum = UserRole.Homeowner;

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
            PostedBy: await MapUserToDto(job.Posted_By_User), 
            CreatedAt: job.Created_At_Utc,
            UpdatedAt: job.Updated_At_Utc,
            BidCount: bidCount,
            ImageUrls: job.Job_Images.OrderBy(img => img.Sort_Order).Select(img => GetPresignedUrl(img.Object_Key)).ToList()
        );
    }

    protected async Task<BidDto> MapBidToDto(Bid bid)
    {
        return new BidDto(
            Id: bid.Id,
            JobId: bid.Job_Id,
            JobName: bid.Job.Title,
            Handyman: await MapUserToDto(bid.Handyman_User), 
            Price: bid.Price,
            EstimatedArrival: bid.Estimated_Arrival_Utc,
            Message: bid.Message,
            Status: BidConstants.ParseFromDb(bid.Status).ToDbString(),
            IsRecommended: bid.Is_Recommended,
            IsLocked: bid.Locked,
            IsFlagged: bid.Flagged,
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
                GetPresignedUrl(handyman.IdentityCardURL),
                GetPresignedUrl(handyman.SelfieImageURL),
                handyman.Created_At_Utc,
                handyman.Updated_At_Utc
        );
    }

    protected async Task MarkAsReadAsync(Guid conversationId, bool isAdminRead = false)
    {
        var currentUserId = await GetCurrentUserIdAsync();
        await Context.Conversation_Participants
            .Where(p => p.Conversation_Id == conversationId && p.User_Id == currentUserId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Unread_Count, 0));

        if (isAdminRead)
            await ChatHubContext.Clients.Group(currentUserId.ToString())
            .SendAsync(HubMethod.NotificationMarkedRead.ToString(), conversationId);
    }
}