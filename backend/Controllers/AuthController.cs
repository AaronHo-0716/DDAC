using Microsoft.AspNetCore.Mvc;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using backend.Models.DTOs;
using Microsoft.AspNetCore.RateLimiting;
using System.Net;

namespace backend.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(IAuthService authService) : BaseController
{
    [HttpPost("register")]
    [EnableRateLimiting("auth_policy")]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterRequest request)
    {
        try {
            return Ok(await authService.Register(request));
        }
        catch (HttpRequestException ex) {
            return HandleError(ex);
        }
    }

    [HttpPost("login")]
    [EnableRateLimiting("auth_policy")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request)
    {
        try {
            var result = await authService.Login(request);

            if (!result.User.IsActive) return StatusCode((int)HttpStatusCode.Forbidden, result);
            
            return Ok(result);
        }
        catch (HttpRequestException ex) {
            return HandleError(ex);
        }
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<UserDto>> GetMe()
    {
        try {
            var userId = await GetCurrentUserIdAsync();
            return Ok(await authService.GetUserById(userId));
        }
        catch (HttpRequestException ex) {
            return HandleError(ex);
        }
    }

    [HttpPost("refresh")]
    [Obsolete("Use specific moderation logs where available.")]
    public async Task<ActionResult<AuthResponse>> Refresh([FromBody] RefreshRequest request)
    {
        try {
            return Ok(await authService.RefreshToken(request.RefreshToken));
        }
        catch (HttpRequestException ex) {
            return HandleError(ex);
        }
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] LogoutRequest request)
    {
        await authService.Logout(request, await GetCurrentUserIdAsync());
        return Ok(new { message = "Logged out successfully." });
    }

    // /api/auth/password/otp/request
    // * POST /api/auth/password/otp/verify
}
