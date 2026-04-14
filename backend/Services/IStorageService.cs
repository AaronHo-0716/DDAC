using backend.Models.DTOs;
using Microsoft.AspNetCore.Http;

namespace backend.Services;

public interface IStorageService
{
    Task<UploadImageResponse> UploadImageAsync(IFormFile file, string prefix, CancellationToken cancellationToken = default);
}
