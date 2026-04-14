using Microsoft.AspNetCore.Http;

namespace backend.Models.DTOs;

public class UploadImageRequest
{
    public IFormFile? File { get; set; }
}

public record UploadImageResponse(
    string ObjectKey,
    string Url,
    long Size,
    string ContentType
);
