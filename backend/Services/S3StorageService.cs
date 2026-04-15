using System.Net;
using Amazon.S3;
using Amazon.S3.Model;
using Amazon.S3.Util;
using backend.Constants;
using backend.Data;
using backend.Models.Config;
using backend.Models.DTOs;
using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace backend.Services;

public class S3StorageService(
    NeighbourHelpDbContext context,
    ILogger<S3StorageService> logger,
    IAmazonS3 s3Client,
    IOptions<StorageOptions> storageOptions) 
    : BaseService(context, logger, s3Client, storageOptions), IStorageService
{
    private readonly IAmazonS3 _s3Client = s3Client;
    private readonly S3StorageOptions _options = storageOptions.Value.S3;

    public async Task<UserDto> UpdateProfilePictureAsync(Guid userId, IFormFile file, CancellationToken ct)
    {
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

    public async Task<HandymanVerificationDto> UpdateIdentityCardAsync(Guid userId, IFormFile file, CancellationToken ct)
    {
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

        return MapJobToDto(job);
    }

    private async Task<UploadImageResponse> UploadImageAsync(IFormFile file, string prefix, CancellationToken ct)
    {
        ValidateImage(file);
        await EnsureBucketExistsAsync(ct);

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var keyPrefix = string.IsNullOrWhiteSpace(prefix) ? "uploads" : prefix.Trim('/');
        var objectKey = $"{keyPrefix}/{DateTime.UtcNow:yyyy/MM}/{Guid.NewGuid()}{extension}";

        await using var stream = file.OpenReadStream();
        var putRequest = new PutObjectRequest { BucketName = _options.BucketName, Key = objectKey, InputStream = stream, ContentType = file.ContentType };
        await _s3Client.PutObjectAsync(putRequest, ct);

        var publicBaseUrl = string.IsNullOrWhiteSpace(_options.PublicBaseUrl) ? _options.ServiceUrl : _options.PublicBaseUrl;
        var imageUrl = $"{publicBaseUrl.TrimEnd('/')}/{_options.BucketName}/{objectKey}";

        return new UploadImageResponse(objectKey, imageUrl, file.Length, file.ContentType);
    }

    private async Task EnsureBucketExistsAsync(CancellationToken cancellationToken)
    {
        if (!_options.AutoCreateBucket) return;

        var exists = await AmazonS3Util.DoesS3BucketExistV2Async(_s3Client, _options.BucketName);
        if (exists) return;

        try
        {
            await _s3Client.PutBucketAsync(new PutBucketRequest
            {
                BucketName = _options.BucketName,
                BucketRegionName = _options.Region,
                UseClientRegion = true
            }, cancellationToken);
            
            Logger.LogInformation("Created missing S3 bucket {BucketName}", _options.BucketName);
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == HttpStatusCode.Conflict)
        {
            Logger.LogDebug("S3 bucket {BucketName} was created concurrently.", _options.BucketName);
        }
    }

    private void ValidateImage(IFormFile file)
    {
        if (string.IsNullOrWhiteSpace(_options.BucketName))
            throw new HttpRequestException("Storage configuration error: Bucket name is missing.", null, HttpStatusCode.InternalServerError);

        if (file == null || file.Length <= 0)
            throw new HttpRequestException("The uploaded file is empty.", null, HttpStatusCode.BadRequest);

        var maxBytes = _options.MaxFileSizeMb * 1024 * 1024;
        if (file.Length > maxBytes)
            throw new HttpRequestException($"File too large. Max allowed size is {_options.MaxFileSizeMb}MB.", null, HttpStatusCode.BadRequest);

        if (string.IsNullOrWhiteSpace(file.ContentType) || !file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            throw new HttpRequestException("Invalid file type. Only image files are allowed.", null, HttpStatusCode.BadRequest);
    }
}