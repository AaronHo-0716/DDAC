using backend.Constants;

namespace backend.Models.DTOs;

public record UploadImageRequest(IFormFile File, UploadTypes UploadType, Guid? TargetId = null);

public record UploadImageResponse(
    string ObjectKey,
    string Url,
    long Size,
    string ContentType
);