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

    public async Task<MessageDto> SendJobChatImageAsync(UploadImageRequest request, CancellationToken ct)
    {
        var currentUserId = await GetCurrentUserIdAsync();
        var conversationId = request.TargetId ?? throw new HttpRequestException("Conversation ID required.", null, HttpStatusCode.BadRequest);

        var conv = await Context.Conversations
            .Include(c => c.Participants)
            .FirstOrDefaultAsync(c => c.Id == conversationId && c.Type == ConversationType.JobChat.ToString(), ct)
            ?? throw new HttpRequestException("Job conversation not found.", null, HttpStatusCode.NotFound);

        if (!conv.Participants.Any(p => p.User_Id == currentUserId))
            throw new HttpRequestException("Access Denied.", null, HttpStatusCode.Forbidden);

        // Upload and Save
        var upload = await UploadImageAsync(request.File, $"{UploadTypes.JobConversationAtt.ToPrefixString()}/{conversationId}", ct);
        
        var message = new Message {
            Id = Guid.NewGuid(), Conversation_Id = conversationId, Sender_User_Id = currentUserId,
            Message_Type = MessageType.Image.ToDbString(), Body_Text = upload.ObjectKey, Created_At_Utc = DateTime.UtcNow
        };

        Context.Messages.Add(message);
        await Context.SaveChangesAsync(ct);

        var dto = MapMessageToDto(message);

        // Push to participants
        var targetIds = conv.Participants.Select(p => p.User_Id.ToString()).ToList();
        await ChatHubContext.Clients.Groups(targetIds).SendAsync(HubMethod.ReceiveMessage.ToString(), new { convId = conversationId, message = dto });

        return dto;
    }

    public async Task<MessageDto> SendSupportChatImageAsync(UploadImageRequest request, CancellationToken ct)
    {
        var currentUserId = await GetCurrentUserIdAsync();
        var currentUserRole = GetCurrentUserRole();
        var conversationId = request.TargetId ?? throw new HttpRequestException("Conversation ID required.", null, HttpStatusCode.BadRequest);

        var conv = await Context.Conversations
            .Include(c => c.Participants)
            .FirstOrDefaultAsync(c => c.Id == conversationId && c.Type == ConversationType.AdminSupport.ToString(), ct)
            ?? throw new HttpRequestException("Support conversation not found.", null, HttpStatusCode.NotFound);

        // Admin Auto-Join Logic
        var isParticipant = conv.Participants.Any(p => p.User_Id == currentUserId);
        if (!isParticipant && currentUserRole == UserRole.Admin.ToDbString())
        {
            Context.Conversation_Participants.Add(new Conversation_Participant {
                Id = Guid.NewGuid(), Conversation_Id = conversationId, User_Id = currentUserId, Participant_Role = UserRole.Admin.ToDbString()
            });
        }
        else if (!isParticipant) throw new HttpRequestException("Forbidden.", null, HttpStatusCode.Forbidden);

        // Upload and Save
        var upload = await UploadImageAsync(request.File, $"{UploadTypes.SupportConversationAtt.ToPrefixString()}/{conversationId}", ct);
        
        var message = new Message {
            Id = Guid.NewGuid(), Conversation_Id = conversationId, Sender_User_Id = currentUserId,
            Message_Type = MessageType.Image.ToDbString(), Body_Text = upload.ObjectKey, Created_At_Utc = DateTime.UtcNow
        };

        Context.Messages.Add(message);
        await Context.SaveChangesAsync(ct);

        var dto = MapMessageToDto(message);

        // Broadcast Logic
        // 1. If user sent, notify Admins group
        if (currentUserRole != UserRole.Admin.ToDbString())
            await ChatHubContext.Clients.Group(UserRole.Admin.ToString()).SendAsync(HubMethod.ReceiveMessage.ToString(), new { convId = conversationId, message = dto });
        
        // 2. Notify current participants
        var targetIds = conv.Participants.Select(p => p.User_Id.ToString()).ToList();
        await ChatHubContext.Clients.Groups(targetIds).SendAsync(HubMethod.ReceiveMessage.ToString(), new { convId = conversationId, message = dto });

        return dto;
    }

    public async Task<BankDetailsDto> UpdateBankStatementProofAsync(UploadImageRequest request, CancellationToken ct)
    {
        var userId = await GetCurrentUserIdAsync();
        var bankDetailsId = request.TargetId
            ?? throw new HttpRequestException("Bank details ID required.", null, HttpStatusCode.BadRequest);

        var bankDetails = await Context.Handyman_Bank_Details
            .FirstOrDefaultAsync(b => b.Id == bankDetailsId && b.Handyman_User_Id == userId, ct)
            ?? throw new HttpRequestException("Bank details not found.", null, HttpStatusCode.NotFound);

        if (bankDetails.Verification_Status is "verified" or "disabled")
            throw new HttpRequestException("Cannot update proof for verified or disabled bank details. Please create a new bank detail instead.", null, HttpStatusCode.BadRequest);

        var hasPendingWithdrawal = await Context.Withdrawal_Requests
            .AnyAsync(w => w.Handyman_User_Id == userId && w.Status == "pending", ct);

        if (hasPendingWithdrawal)
            throw new HttpRequestException("Cannot update bank proof while you have a pending withdrawal request.", null, HttpStatusCode.BadRequest);

        try
        {
            var upload = await UploadImageAsync(request.File, $"{UploadTypes.BankStatementProof.ToPrefixString()}/{userId}/{bankDetails.Id}", ct);

            bankDetails.Bank_Statement_Proof_Url = upload.ObjectKey;
            bankDetails.Verification_Status = "unverified";
            bankDetails.Rejection_Reason = null;
            bankDetails.Verified_At_Utc = null;
            bankDetails.Verified_By_User_Id = null;
            bankDetails.Updated_At_Utc = DateTime.UtcNow;

            await Context.SaveChangesAsync(ct);

            Logger.LogInformation("Bank statement uploaded for handyman {HandymanId}, bank details {BankDetailsId}", userId, bankDetailsId);

            return new BankDetailsDto(
                Id: bankDetails.Id,
                BankName: bankDetails.Bank_Name,
                AccountName: bankDetails.Account_Name,
                AccountNumber: bankDetails.Account_Number,
                VerificationStatus: bankDetails.Verification_Status,
                BankStatementProofUrl: GetPresignedUrl(bankDetails.Bank_Statement_Proof_Url),
                RejectionReason: bankDetails.Rejection_Reason,
                VerifiedAtUtc: bankDetails.Verified_At_Utc ?? DateTime.MinValue,
                CreatedAtUtc: bankDetails.Created_At_Utc,
                UpdatedAtUtc: bankDetails.Updated_At_Utc
            );
        }
        catch (HttpRequestException)
        {
            throw;
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Failed to upload bank statement for handyman {HandymanId}", userId);
            throw new HttpRequestException("Failed to upload bank statement. Please try again.", null, HttpStatusCode.InternalServerError);
        }
    }

    private async Task<UploadImageResponse> UploadImageAsync(IFormFile file, string prefix, CancellationToken ct)
    {
        ValidateImage(file);
        return await UploadFileAsync(file, prefix, ct);
    }

    private async Task<UploadImageResponse> UploadFileAsync(IFormFile file, string prefix, CancellationToken ct)
    {
        await EnsureBucketExistsAsync(ct);

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var keyPrefix = string.IsNullOrWhiteSpace(prefix) ? "uploads" : prefix.Trim('/');
        var objectKey = $"{keyPrefix}/{DateTime.UtcNow:yyyy/MM}/{Guid.NewGuid()}{extension}";

        await using var stream = file.OpenReadStream();
        var putRequest = new PutObjectRequest { BucketName = StorageOptions.BucketName, Key = objectKey, InputStream = stream, ContentType = file.ContentType };
        await S3Client.PutObjectAsync(putRequest, ct);

        string imageUrl;
        var request = HttpContextAccessor?.HttpContext?.Request;
        if (request != null)
        {
            imageUrl = BuildStorageProxyUrl(request, StorageOptions.BucketName, objectKey);
        }
        else
        {
            var publicBaseUrl = string.IsNullOrWhiteSpace(StorageOptions.PublicBaseUrl) ? StorageOptions.ServiceUrl : StorageOptions.PublicBaseUrl;
            imageUrl = $"{publicBaseUrl.TrimEnd('/')}/{StorageOptions.BucketName}/{objectKey}";
        }

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
