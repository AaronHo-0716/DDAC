using backend.Data;
using backend.Models.DTOs;
using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace backend.Services;

public class AuthService(NeighbourHelpDbContext context, IConfiguration config) : IAuthService
{
    public async Task<AuthResponse> Login(LoginRequest request)
    {
        var user = await context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);

        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            throw new HttpRequestException("Invalid email or password", null, System.Net.HttpStatusCode.Unauthorized);

        return GenerateAuthResponse(user);
    }

    public async Task<AuthResponse> Register(RegisterRequest request)
    {
        if (await context.Users.AnyAsync(u => u.Email == request.Email))
            throw new Exception("User already exists");

        var user = new User
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Email = request.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = request.Role.ToLower(),
            CreatedAtUtc = DateTime.UtcNow,
            IsActive = true
        };

        context.Users.Add(user);
        await context.SaveChangesAsync();

        return GenerateAuthResponse(user);
    }

    public async Task<UserDto> GetUserById(Guid userId)
    {
        var user = await context.Users.FindAsync(userId);
        if (user == null) throw new Exception("User not found");
        return MapToDto(user);
    }

    public async Task<AuthResponse> RefreshToken(string token)
    {
        // For v1 MVP, we aren't validating the old refresh token against a DB yet.
        // We just return a new set of tokens for the demo to work.
        // In a real app, you would verify the token from a 'RefreshTokens' table.
        return await Task.FromResult(new AuthResponse(
            new UserDto(Guid.Empty, "System", "refresher", "user", null, null, DateTime.UtcNow, true),
            new TokenDto("new_access_token", Guid.NewGuid().ToString())
        ));
    }

    private AuthResponse GenerateAuthResponse(User user)
    {
        return new AuthResponse(
            User: MapToDto(user),
            Tokens: new TokenDto(
                AccessToken: CreateJwtToken(user),
                RefreshToken: Guid.NewGuid().ToString()
            )
        );
    }

    private UserDto MapToDto(User user) => new UserDto(
        user.Id,
        user.Name,
        user.Email,
        user.Role.ToLower(),
        user.AvatarUrl,
        user.Rating,
        user.CreatedAtUtc,
        user.IsActive
    );

    private string CreateJwtToken(User user)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, user.Role)
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"],
            audience: config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddDays(1),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
