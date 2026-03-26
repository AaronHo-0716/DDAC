using Microsoft.AspNetCore.Mvc;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using backend.Models.DTOs;
using System.Security.Claims;
using backend.Models;
using backend.Data;

[ApiController]
[Route("api/auth")]
public class AuthController(IAuthService authService) : ControllerBase
{
    private readonly NeighbourHelpDbContext _context;
    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request)
    {
        var result = await authService.RegisterAsync(request);
        return Ok(result);
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
    {
        var result = await authService.LoginAsync(request);
        return Ok(result);
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<UserDto>> GetMe()
    {
        // Get user ID from the JWT claims
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var user = await authService.GetUserByIdAsync(Guid.Parse(userId!));
        return Ok(user);
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResponse>> Refresh(RefreshRequest request)
    {
        var result = await authService.RefreshTokenAsync(request.RefreshToken);
        return Ok(result);
    }

    [Authorize]
    [HttpPost("logout")]
    public IActionResult Logout()
    {
        // For JWT, logout is mostly handled by the frontend clearing tokens,
        // but we return 200 OK as expected by your frontend.
        return Ok();
    }
}
