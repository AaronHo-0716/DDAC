using System.Net;
using Amazon.S3;
using Amazon.S3.Model;
using Amazon.S3.Util;
using backend.Constants;
using backend.Data;
using backend.Models.Config;
using backend.Models.DTOs;
using Microsoft.Extensions.Options;

namespace backend.Services;

public class S3StorageService(
    NeighbourHelpDbContext context,
    ILogger<S3StorageService> logger,
    IAmazonS3 s3Client,
    IOptions<StorageOptions> storageOptions) 
    : BaseService(context, logger), IStorageService
{
    private readonly IAmazonS3 _s3Client = s3Client;
    private readonly S3StorageOptions _options = storageOptions.Value.S3;

    public async Task<UserDto> UpdateProfilePictureAsync(Guid userId, IFormFile file, CancellationToken cancellationToken = default)
    {
        var user = await Context.Users.FindAsync([userId], cancellationToken)
            ?? throw new HttpRequestException("User not found.", null, HttpStatusCode.NotFound);

        var upload = await UploadImageAsync(file, $"{UploadTypes.AvatarImage.ToPrefixString()}/{user.Id}", cancellationToken);
        
        user.AvatarUrl = upload.Url;
        user.Updated_At_Utc = DateTime.UtcNow;

        await Context.SaveChangesAsync(cancellationToken);
        Logger.LogInformation("Profile picture updated for user {UserId}", user.Id);

        return await MapUserToDto(user);
    }

    public async Task<UploadImageResponse> UploadImageAsync(IFormFile file, string prefix, CancellationToken cancellationToken = default)
    {
        ValidateImage(file);
        await EnsureBucketExistsAsync(cancellationToken);

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var keyPrefix = string.IsNullOrWhiteSpace(prefix) ? "uploads" : prefix.Trim('/');
        
        var objectKey = $"{keyPrefix}/{DateTime.UtcNow:yyyy/MM}/{Guid.NewGuid()}{extension}";

        await using var stream = file.OpenReadStream();
        var putRequest = new PutObjectRequest
        {
            BucketName = _options.BucketName,
            Key = objectKey,
            InputStream = stream,
            ContentType = file.ContentType
        };

        await _s3Client.PutObjectAsync(putRequest, cancellationToken);

        var publicBaseUrl = string.IsNullOrWhiteSpace(_options.PublicBaseUrl)
            ? _options.ServiceUrl
            : _options.PublicBaseUrl;

        var imageUrl = string.IsNullOrWhiteSpace(publicBaseUrl)
            ? $"s3://{_options.BucketName}/{objectKey}"
            : $"{publicBaseUrl.TrimEnd('/')}/{_options.BucketName}/{objectKey}";

        Logger.LogInformation("Image uploaded to S3. Bucket: {Bucket}, Key: {Key}", _options.BucketName, objectKey);

        return new UploadImageResponse(
            ObjectKey: objectKey,
            Url: imageUrl,
            Size: file.Length,
            ContentType: file.ContentType
        );
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