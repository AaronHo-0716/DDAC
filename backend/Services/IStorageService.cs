using backend.Models.DTOs;
namespace backend.Services;

public interface IStorageService
{
    Task<UserDto> UpdateProfilePictureAsync(Guid userId, IFormFile file, CancellationToken cancellationToken = default);
    Task<UploadImageResponse> UploadImageAsync(IFormFile file, string prefix, CancellationToken cancellationToken = default);
}
