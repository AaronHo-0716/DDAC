using backend.Models.DTOs;
using backend.Constants;

namespace backend.Services;

public interface IStorageService
{
    Task<UserDto> UpdateProfilePictureAsync(Guid userId, IFormFile file, CancellationToken ct);
    Task<JobDto> UpdateJobImageAsync(UploadImageRequest request, CancellationToken ct);
    Task<HandymanVerificationDto> UpdateIdentityCardAsync(Guid userId, IFormFile file, CancellationToken ct);
    Task<MessageDto> SendChatAttachmentAsync(Guid userId, UploadImageRequest request, CancellationToken ct);
}
