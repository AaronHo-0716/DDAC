using Microsoft.AspNetCore.Mvc;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using backend.Models.DTOs;
using Microsoft.AspNetCore.RateLimiting;

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
            return Ok(await authService.GetUserById());
        }
        catch (HttpRequestException ex) {
            return HandleError(ex);
        }
    }

    [HttpPost("refresh")]
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
        await authService.Logout(request);
        return Ok(new { message = "Logged out successfully." });
    }

    [Authorize(Roles = "handyman")]
    [HttpPost("pending-verification")]
    public async Task<ActionResult<HandymanVerificationDto>> ResubmitVerification()
    {
        try {
            return Ok(await authService.CreateHandymanVerification());
        }
        catch (HttpRequestException ex) {
            return HandleError(ex);
        }
    }

    // /api/auth/password/otp/request
    // * POST /api/auth/password/otp/verify
}
