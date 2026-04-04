using backend.Models.DTOs;

namespace backend.Services;

public interface IAuthService
{
    Task<AuthResponse> Register(RegisterRequest request);
    Task<AuthResponse> Login(LoginRequest request);
    Task<UserDto> GetUserById(int userId);
    Task<AuthResponse> RefreshToken(string token);
}
