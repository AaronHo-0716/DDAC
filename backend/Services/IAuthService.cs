using backend.Models.DTOs;

namespace backend.Services;

public interface IAuthService
{
    Task<AuthResponse> Register(RegisterRequest request);
    Task<AuthResponse> Login(LoginRequest request);
    Task<UserDto> GetUserById();
    Task<AuthResponse> RefreshToken(string token);
    Task Logout(LogoutRequest request);
    Task<HandymanVerificationDto> CreateHandymanVerification();
}
