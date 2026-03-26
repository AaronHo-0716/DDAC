using backend.Data;
using backend.Models;
using backend.Models.DTOs;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace backend.Services;

public interface IAuthService
{
    Task<AuthResponse> RegisterAsync(RegisterRequest request);
    Task<AuthResponse> LoginAsync(LoginRequest request);
    Task<UserDto> GetUserByIdAsync(Guid userId);
    Task<AuthResponse> RefreshTokenAsync(string token);
}

public class AuthService : IAuthService
{
    private readonly NeighbourHelpDbContext _context;
    private readonly IConfiguration _config;

    public AuthService(NeighbourHelpDbContext context, IConfiguration config)
    {
        _context = context;
        _config = config;
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request)
    {
        var user = await _context.users.FirstOrDefaultAsync(u => u.email == request.Email);

        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.password_hash))
            throw new HttpRequestException("Invalid email or password", null, System.Net.HttpStatusCode.Unauthorized);

        return GenerateAuthResponse(user);
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request)
    {
        if (await _context.users.AnyAsync(u => u.email == request.Email))
            throw new Exception("User already exists");

        var newUser = new user
        {
            id = Guid.NewGuid(),
            name = request.Name,
            email = request.Email,
            password_hash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            created_at_utc = DateTime.UtcNow,
            updated_at_utc = DateTime.UtcNow,
            must_reset_password = false
        };

        _context.users.Add(newUser);
        await _context.SaveChangesAsync();

        return GenerateAuthResponse(newUser);
    }

    public async Task<UserDto> GetUserByIdAsync(Guid userId)
    {
        var user = await _context.users.FindAsync(userId);
        if (user == null) throw new Exception("User not found");
        return MapToDto(user);
    }

    public async Task<AuthResponse> RefreshTokenAsync(string token)
    {
        // For v1 MVP, we aren't validating the old refresh token against a DB yet.
        // We just return a new set of tokens for the demo to work.
        // In a real app, you would verify the token from a 'RefreshTokens' table.
        return await Task.FromResult(new AuthResponse(
            new UserDto(Guid.Empty, "System", "refresher", "user", null, null, DateTime.UtcNow, true),
            new TokenDto("new_access_token", Guid.NewGuid().ToString())
        ));
    }

    private AuthResponse GenerateAuthResponse(user user)
    {
        return new AuthResponse(
            User: MapToDto(user),
            Tokens: new TokenDto(
                AccessToken: CreateJwtToken(user),
                RefreshToken: Guid.NewGuid().ToString()
            )
        );
    }

    private UserDto MapToDto(user user) => new UserDto(
        user.id,
        user.name,
        user.email,
        "user",
        user.avatar_url,
        user.rating,
        user.created_at_utc,
        true
    );

    private string CreateJwtToken(user user)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.id.ToString()),
            new(ClaimTypes.Email, user.email),
            new(ClaimTypes.Role, "user")
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddDays(1),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
