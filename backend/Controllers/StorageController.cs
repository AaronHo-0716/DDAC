using System.Net;
using Amazon.S3;
using Amazon.S3.Model;
using backend.Models.Config;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace backend.Controllers;

[ApiController]
[Route("api/storage")]
public class StorageController : ControllerBase
{
    private readonly IAmazonS3 _s3Client;
    private readonly S3StorageOptions _storageOptions;
    private readonly ILogger<StorageController> _logger;

    public StorageController(IAmazonS3 s3Client, IOptions<StorageOptions> storageOptions, ILogger<StorageController> logger)
    {
        _s3Client = s3Client;
        _storageOptions = storageOptions?.Value?.S3 ?? new S3StorageOptions();
        _logger = logger;
    }

    [HttpGet("{bucket}/{**key}")]
    public async Task<IActionResult> GetObject(string bucket, string key, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(bucket) || string.IsNullOrWhiteSpace(key))
            return BadRequest();

        if (!string.Equals(bucket, _storageOptions.BucketName, StringComparison.OrdinalIgnoreCase))
            return NotFound();

        try
        {
            var response = await _s3Client.GetObjectAsync(bucket, key, ct);
            var contentType = response.Headers.ContentType ?? "application/octet-stream";
            return File(response.ResponseStream, contentType);
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return NotFound();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to proxy storage object {Bucket}/{Key}", bucket, key);
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message, details = ex.ToString() });
        }
    }
}
