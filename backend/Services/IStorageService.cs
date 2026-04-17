using backend.Models.DTOs;
using backend.Constants;

namespace backend.Services;

public interface IStorageService
{
    Task<UserDto> UpdateProfilePictureAsync(IFormFile file, CancellationToken ct);
    Task<JobDto> UpdateJobImageAsync(UploadImageRequest request, CancellationToken ct);
    Task<HandymanVerificationDto> UpdateIdentityCardAsync(IFormFile file, CancellationToken ct);
    Task<MessageDto> SendChatAttachmentAsync(UploadImageRequest request, CancellationToken ct);
}
