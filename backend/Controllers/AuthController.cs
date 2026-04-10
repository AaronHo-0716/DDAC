using Microsoft.AspNetCore.Mvc;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using backend.Models.DTOs;
using System.Security.Claims;
using System.Net;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("api/auth")]
public class AuthController(IAuthService authService) : ControllerBase
{
    [HttpPost("register")]
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
            // Catches 400 (Bad Request) or 409 (Conflict) from the service
            return StatusCode((int)(ex.StatusCode ?? HttpStatusCode.InternalServerError), new { message = ex.Message });
        }
        catch (Exception ex)
        {
            // Catches unexpected server crashes
            return StatusCode(500, new { message = "An internal server error occurred.", details = ex.Message });
        }
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
    {
        try
        {
            var result = await authService.Login(request);
            return Ok(result);
        }
        catch (HttpRequestException ex)
        {
            // Catches 401 (Unauthorized) or 400 (Bad Request)
            return StatusCode((int)(ex.StatusCode ?? HttpStatusCode.InternalServerError), new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An internal server error occurred.", details = ex.Message });
        }
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<UserDto>> GetMe()
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var user = await authService.GetUserById(Guid.Parse(userId));
            return Ok(user);
        }
        catch (HttpRequestException ex)
        {
            return StatusCode((int)(ex.StatusCode ?? HttpStatusCode.InternalServerError), new { message = ex.Message });
        }
        catch (Exception)
        {
            return StatusCode(500, new { message = "An error occurred while fetching your profile." });
        }
    }

    [HttpPost("refresh")]
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
        // Extract User ID from the valid JWT claims
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdClaim)) return Unauthorized();

        var userId = Guid.Parse(userIdClaim);

        try
        {
            await authService.Logout(request, userId);

            return Ok(new 
            { 
                message = "Logged out successfully. All active access tokens for this account have been invalidated.",
                serverTime = DateTime.UtcNow 
            });
        }
        catch (Exception ex)
        {
            // Log internal errors but don't expose DB details
            return StatusCode(500, new { message = "An error occurred during logout.", details = ex.Message });
        }
    }
}
