using Microsoft.AspNetCore.Mvc;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using backend.Models.DTOs;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.RateLimiting;
using System.Security.Claims;
using System.Net;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(IAuthService authService, ILogger<AuthController> logger) : ControllerBase
{
    [HttpPost("register")]
    [EnableRateLimiting("auth_policy")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request)
    {
        try
        {
            var result = await authService.Register(request);
            return Ok(result);
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "A user with this email already exists." });
        }
        catch (HttpRequestException ex)
        {
            return StatusCode((int)(ex.StatusCode ?? HttpStatusCode.InternalServerError), new { message = ex.Message });
        }
    }

    [HttpPost("login")]
    [EnableRateLimiting("auth_policy")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
    {
        try
        {
            var result = await authService.Login(request);
            return Ok(result);
        }
        catch (HttpRequestException ex) when (ex.Message.StartsWith("BLOCKED_USER_ERROR:"))
        {
            var reason = ex.Message.Replace("BLOCKED_USER_ERROR:", "");
            return BadRequest(new BlockedUserResponse(
                Message: "Your account is currently blocked. Please contact support.",
                Reason: reason,
                BlockedAt: null 
            ));
        }
        catch (HttpRequestException ex)
        {
            return StatusCode((int)(ex.StatusCode ?? HttpStatusCode.InternalServerError), new { message = ex.Message });
        }
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<UserDto>> GetMe()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        try
        {
            var user = await authService.GetUserById(Guid.Parse(userId));
            return Ok(user);
        }
        catch (HttpRequestException ex)
        {
            return StatusCode((int)(ex.StatusCode ?? HttpStatusCode.InternalServerError), new { message = ex.Message });
        }
    }

    [HttpPost("refresh")]
    [Obsolete("This endpoint is currently not in use. ")]
    public async Task<ActionResult<AuthResponse>> Refresh(RefreshRequest request)
    {
        try
        {
            var result = await authService.RefreshToken(request.RefreshToken);
            return Ok(result);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(new { message = "Refresh token is currently being processed. Please try again." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] LogoutRequest request)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdClaim)) return Unauthorized();

        var userId = Guid.Parse(userIdClaim);
        await authService.Logout(request, userId);

        return Ok(new 
        { 
            message = "Logged out successfully. All active access tokens for this account have been invalidated.",
            serverTime = DateTime.UtcNow 
        });
    }

    [HttpPost("report")]
    [Authorize]
    [EnableRateLimiting("auth_policy")]
    public async Task<IActionResult> Report([FromBody] CreateReportRequest request)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdClaim)) return Unauthorized();
    
        try
        {
            await authService.CreateReportAsync(request, Guid.Parse(userIdClaim));
            return Ok(new { message = "Report submitted successfully. Administrators will review it shortly." });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred while processing your report.", details = ex.Message });
        }
    }

    [HttpGet("reports")]
    [Authorize]
    public async Task<ActionResult<IEnumerable<UserReportDto>>> GetMyReports()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdClaim)) return Unauthorized();

        var reports = await authService.GetMyReportsAsync(Guid.Parse(userIdClaim));
        return Ok(reports);
    }
}
