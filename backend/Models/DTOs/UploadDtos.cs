namespace backend.Models.DTOs;

public record UploadImageRequest(IFormFile File);

public record UploadImageResponse(
    string ObjectKey,
    string Url,
    long Size,
    string ContentType
);