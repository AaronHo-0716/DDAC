using backend.Constants;

namespace backend.Models.DTOs;

public record UploadImageRequest(IFormFile File, UploadTypes UploadType);

public record UploadImageResponse(
    string ObjectKey,
    string Url,
    long Size,
    string ContentType
);