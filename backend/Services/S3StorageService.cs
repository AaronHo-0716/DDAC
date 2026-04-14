using System.Net;
using Amazon.S3;
using Amazon.S3.Model;
using Amazon.S3.Util;
using backend.Models.Config;
using backend.Models.DTOs;
using Microsoft.Extensions.Options;

namespace backend.Services;

public class S3StorageService(
    IAmazonS3 s3Client,
    IOptions<StorageOptions> storageOptions,
    ILogger<S3StorageService> logger) : IStorageService
{
    private readonly IAmazonS3 _s3Client = s3Client;
    private readonly ILogger<S3StorageService> _logger = logger;
    private readonly S3StorageOptions _options = storageOptions.Value.S3;

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

        _logger.LogInformation("Image uploaded to S3. Bucket: {Bucket}, Key: {Key}", _options.BucketName, objectKey);

        return new UploadImageResponse(
            ObjectKey: objectKey,
            Url: imageUrl,
            Size: file.Length,
            ContentType: file.ContentType
        );
    }

    private async Task EnsureBucketExistsAsync(CancellationToken cancellationToken)
    {
        if (!_options.AutoCreateBucket)
        {
            return;
        }

        var exists = await AmazonS3Util.DoesS3BucketExistV2Async(_s3Client, _options.BucketName);
        if (exists)
        {
            return;
        }

        try
        {
            await _s3Client.PutBucketAsync(
                new PutBucketRequest
                {
                    BucketName = _options.BucketName,
                    BucketRegionName = _options.Region,
                    UseClientRegion = true
                },
                cancellationToken);
            _logger.LogInformation("Created missing S3 bucket {BucketName}", _options.BucketName);
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == HttpStatusCode.Conflict)
        {
            _logger.LogDebug("S3 bucket {BucketName} was created concurrently.", _options.BucketName);
        }
    }

    private void ValidateImage(IFormFile file)
    {
        if (string.IsNullOrWhiteSpace(_options.BucketName))
        {
            throw new HttpRequestException("Storage bucket is not configured.", null, HttpStatusCode.InternalServerError);
        }

        if (file.Length <= 0)
        {
            throw new HttpRequestException("File is empty.", null, HttpStatusCode.BadRequest);
        }

        var maxBytes = _options.MaxFileSizeMb * 1024 * 1024;
        if (file.Length > maxBytes)
        {
            throw new HttpRequestException($"Max allowed image size is {_options.MaxFileSizeMb}MB.", null, HttpStatusCode.BadRequest);
        }

        if (string.IsNullOrWhiteSpace(file.ContentType) || !file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
        {
            throw new HttpRequestException("Only image files are allowed.", null, HttpStatusCode.BadRequest);
        }
    }
}
