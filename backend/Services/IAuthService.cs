using backend.Models.DTOs;
using System;
using System.Threading.Tasks;

namespace backend.Services;

public interface IAuthService
{
    Task<AuthResponse> Register(RegisterRequest request);
    Task<AuthResponse> Login(LoginRequest request);
    Task<UserDto> GetUserById(Guid userId);
    Task<AuthResponse> RefreshToken(string token);
    Task Logout(LogoutRequest request, Guid userId);
    Task CreateReportAsync(CreateReportRequest request, Guid reporterId);
    Task<IEnumerable<UserReportDto>> GetMyReportsAsync(Guid userId);
}
