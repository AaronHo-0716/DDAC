using backend.Models.DTOs;
using Microsoft.AspNetCore.Http;

namespace backend.Services;

public interface IAuthService
{
    Task<AuthResponse> Register(RegisterRequest request);
    Task<AuthResponse> Login(LoginRequest request);
    Task<UserDto> GetUserById(Guid userId);
    Task<UserDto> UpdateProfilePictureAsync(Guid userId, IFormFile file, CancellationToken cancellationToken = default);
    Task<AuthResponse> RefreshToken(string token);
    Task Logout(LogoutRequest request, Guid userId);
}
