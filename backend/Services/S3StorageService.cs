using System.Net;
using Amazon.S3;
using Amazon.S3.Model;
using Amazon.S3.Util;
using backend.Constants;
using backend.Models.DTOs;
using backend.Models.Entities;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public class S3StorageService(ServiceDependencies deps) : BaseService(deps), IStorageService
{
    public async Task<UserDto> UpdateProfilePictureAsync(IFormFile file, CancellationToken ct)
    {
        var userId = await GetCurrentUserIdAsync();

        var user = await Context.Users
            .Include(u => u.Handyman_Verification_User) 
            .FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new HttpRequestException("User not found.", null, HttpStatusCode.NotFound);
        
        if (user.Role == UserRole.Handyman.ToDbString() && 
            user.Handyman_Verification_User?.Status == VerificationStatus.Approved.ToDbString())
                throw new HttpRequestException("Profile images cannot be changed once a Handyman account has been approved. Please contact support for assistance.", null, HttpStatusCode.BadRequest);

        var upload = await UploadImageAsync(file, $"{UploadTypes.AvatarImage.ToPrefixString()}/{user.Id}", ct);

        user.AvatarUrl = upload.ObjectKey;
        user.Updated_At_Utc = DateTime.UtcNow;

        await Context.SaveChangesAsync(ct);
        
        Logger.LogInformation("Profile picture updated for user {UserId}", user.Id);

        return await MapUserToDto(user);
    }

    public async Task<HandymanVerificationDto> UpdateIdentityCardAsync(IFormFile file, CancellationToken ct)
    {
        var userId = await GetCurrentUserIdAsync();

        var handyman = await Context.Handyman_Verifications
            .Include(v => v.User)
            .Where(x => x.User_Id == userId)
            .OrderByDescending(x => x.Created_At_Utc)
            .FirstOrDefaultAsync(ct)
            ?? throw new HttpRequestException("Handyman verification record not found.", null, HttpStatusCode.NotFound);

        if (handyman.Status == VerificationStatus.Approved.ToDbString())
            throw new HttpRequestException("Identity card images cannot be updated after approval. Please contact support for assistance", null, HttpStatusCode.BadRequest);

        var upload = await UploadImageAsync(file, $"{UploadTypes.IdentityCardImage.ToPrefixString()}/{handyman.Id}", ct);

        handyman.IdentityCardURL = upload.ObjectKey;
        handyman.Updated_At_Utc = DateTime.UtcNow;

        await Context.SaveChangesAsync(ct);
        
        Logger.LogInformation("Profile picture updated for user {UserId}", handyman.Id);

        return MapPendingToDto(handyman);
    }

    public async Task<JobDto> UpdateJobImageAsync(UploadImageRequest request, CancellationToken ct)
    {
        var job = await Context.Jobs
                    .Include(j => j.Posted_By_User)
                    .Include(j => j.Job_Images)
                    .FirstOrDefaultAsync(j => j.Id == request.TargetId, ct)
                    ?? throw new HttpRequestException("Job not found.", null, HttpStatusCode.NotFound);

        var upload = await UploadImageAsync(request.File, $"{UploadTypes.JobImage.ToPrefixString()}/{job.Id}", ct);

        var currentCount = await Context.Job_Images.CountAsync(i => i.Job_Id == job.Id, ct);

        job.Updated_At_Utc = DateTime.UtcNow;

        Context.Job_Images.Add(
            new Job_Image
            {
                Id = Guid.NewGuid(),
                Job_Id = job.Id,
                Image_Url = upload.Url,
                Object_Key = upload.ObjectKey,
                Sort_Order = currentCount,
                Created_At_Utc = DateTime.UtcNow
            }
        );

        await Context.SaveChangesAsync(ct);

        return await MapJobToDto(job);
    }

    public async Task<MessageDto> SendChatAttachmentAsync(UploadImageRequest request, CancellationToken ct)
    {
        var userId = await GetCurrentUserIdAsync();

        if (!request.TargetId.HasValue)
            throw new HttpRequestException("Target Conversation ID is required for chat attachments.", null, HttpStatusCode.BadRequest);
    
        var conversation = await Context.Conversations
            .Include(c => c.Participants)
            .FirstOrDefaultAsync(c => c.Id == request.TargetId, ct)
            ?? throw new HttpRequestException("Conversation not found.", null, HttpStatusCode.NotFound);

        if (conversation.Status == ConversationStatus.Locked.ToDbString())
            throw new HttpRequestException("Conversation is locked.", null, HttpStatusCode.BadRequest);

        if (!conversation.Participants.Any(p => p.User_Id == userId))
            throw new HttpRequestException("Access denied: You are not a participant.", null, HttpStatusCode.Forbidden);

        var prefix = $"{UploadTypes.ChatAttachmentImage.ToPrefixString()}/{request.TargetId}";
        var upload = await UploadImageAsync(request.File, prefix, ct);

        var message = new Message
        {
            Id = Guid.NewGuid(),
            Conversation_Id = request.TargetId.Value,
            Sender_User_Id = userId,
            Message_Type = MessageType.Image.ToDbString(),
            Body_Text = upload.ObjectKey, 
            Created_At_Utc = DateTime.UtcNow
        };

        Context.Messages.Add(message);
        
        conversation.Last_Message_At_Utc = DateTime.UtcNow;

        await Context.Conversation_Participants
            .Where(p => p.Conversation_Id == request.TargetId && p.User_Id != userId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Unread_Count, p => p.Unread_Count + 1), ct);

        await Context.SaveChangesAsync(ct);

        var dto = MapMessageToDto(message);

        var targetIds = conversation.Participants.Select(p => p.User_Id.ToString()).ToList();
        
        await ChatHubContext.Clients.Groups(targetIds)
            .SendAsync(HubMethod.ReceiveMessage.ToString(), new { convId = request.TargetId, message = dto });

        return dto;
    }

    private async Task<UploadImageResponse> UploadImageAsync(IFormFile file, string prefix, CancellationToken ct)
    {
        ValidateImage(file);
        await EnsureBucketExistsAsync(ct);

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var keyPrefix = string.IsNullOrWhiteSpace(prefix) ? "uploads" : prefix.Trim('/');
        var objectKey = $"{keyPrefix}/{DateTime.UtcNow:yyyy/MM}/{Guid.NewGuid()}{extension}";

        await using var stream = file.OpenReadStream();
        var putRequest = new PutObjectRequest { BucketName = StorageOptions.BucketName, Key = objectKey, InputStream = stream, ContentType = file.ContentType };
        await S3Client.PutObjectAsync(putRequest, ct);

        var publicBaseUrl = string.IsNullOrWhiteSpace(StorageOptions.PublicBaseUrl) ? StorageOptions.ServiceUrl : StorageOptions.PublicBaseUrl;
        var imageUrl = $"{publicBaseUrl.TrimEnd('/')}/{StorageOptions.BucketName}/{objectKey}";

        return new UploadImageResponse(objectKey, imageUrl, file.Length, file.ContentType);
    }

    private async Task EnsureBucketExistsAsync(CancellationToken cancellationToken)
    {
        if (!StorageOptions.AutoCreateBucket) return;

        var exists = await AmazonS3Util.DoesS3BucketExistV2Async(S3Client, StorageOptions.BucketName);
        if (exists) return;

        try
        {
            await S3Client.PutBucketAsync(new PutBucketRequest
            {
                BucketName = StorageOptions.BucketName,
                BucketRegionName = StorageOptions.Region,
                UseClientRegion = true
            }, cancellationToken);
            
            Logger.LogInformation("Created missing S3 bucket {BucketName}", StorageOptions.BucketName);
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == HttpStatusCode.Conflict)
        {
            Logger.LogDebug("S3 bucket {BucketName} was created concurrently.", StorageOptions.BucketName);
        }
    }

    private void ValidateImage(IFormFile file)
    {
        if (string.IsNullOrWhiteSpace(StorageOptions.BucketName))
            throw new HttpRequestException("Storage configuration error: Bucket name is missing.", null, HttpStatusCode.InternalServerError);

        if (file == null || file.Length <= 0)
            throw new HttpRequestException("The uploaded file is empty.", null, HttpStatusCode.BadRequest);

        var maxBytes = StorageOptions.MaxFileSizeMb * 1024 * 1024;
        if (file.Length > maxBytes)
            throw new HttpRequestException($"File too large. Max allowed size is {StorageOptions.MaxFileSizeMb}MB.", null, HttpStatusCode.BadRequest);

        if (string.IsNullOrWhiteSpace(file.ContentType) || !file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            throw new HttpRequestException("Invalid file type. Only image files are allowed.", null, HttpStatusCode.BadRequest);
    }
}