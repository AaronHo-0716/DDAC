using backend.Constants;
using backend.Models.DTOs;

namespace backend.Services;

public interface IAuthService
{
    Task<string> Register(RegisterRequest request);
    Task<AuthResponse> VerifyEmailOtpAsync(VerifyOtpRequest req);
    Task<AuthResponse> Login(LoginRequest request);
    Task<UserDto> GetUserById();
    Task<AuthResponse> RefreshToken(string token);
    Task Logout(LogoutRequest request);
    Task<HandymanVerificationDto> CreateHandymanVerification();
    Task SendOtpAsync(string email, EmailPurpose purpose);
    Task ForgotPasswordAsync(string email);
    Task<AuthResponse> ResetPasswordAsync(ResetPasswordRequest req);
    Task<AuthResponse> ChangePasswordAsync(ChangePasswordRequest req);
}
