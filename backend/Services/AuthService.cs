using backend.Data;
using backend.Models.DTOs;
using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Net;

namespace backend.Services;

public class AuthService(NeighbourHelpDbContext context, IConfiguration config) : IAuthService
{
    private static readonly string[] AllowedRoles = ["handyman", "homeowner", "admin"];

    public async Task<AuthResponse> Login(LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            throw new HttpRequestException("Email and password are required.", null, HttpStatusCode.BadRequest);

        // This uses context.users which is now mapped to "public.users"
        var user = await context.users
            .FirstOrDefaultAsync(u => u.Email == request.Email.ToLower().Trim());

        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            throw new HttpRequestException("Invalid email or password.", null, HttpStatusCode.Unauthorized);

        return GenerateAuthResponse(user);
    }

    public async Task<AuthResponse> Register(RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password) || string.IsNullOrWhiteSpace(request.Name))
            throw new HttpRequestException("All fields are required.", null, HttpStatusCode.BadRequest);

        if (!IsValidEmail(request.Email))
            throw new HttpRequestException("Invalid email format.", null, HttpStatusCode.BadRequest);

        var emailLower = request.Email.ToLower().Trim();
        if (await context.users.AnyAsync(u => u.Email == emailLower))
            throw new HttpRequestException("Email already exists.", null, HttpStatusCode.Conflict);

        var newUser = new user
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Email = emailLower,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = request.Role?.ToLower() ?? "homeowner",
            IsActive = true
        };

        context.users.Add(newUser);
        await context.SaveChangesAsync();

        return GenerateAuthResponse(newUser);
    }

    public async Task<UserDto> GetUserById(Guid userId)
    {
        var user = await context.users.FindAsync(userId);
        if (user == null) throw new HttpRequestException("User not found.", null, HttpStatusCode.NotFound);
        return MapToDto(user);
    }

    public async Task<AuthResponse> RefreshToken(string token)
    {
        // Mocking refresh logic
        var userDto = new UserDto(Guid.Empty, "System", "ref@example.com", "user", null, null, DateTime.UtcNow, true);
        return await Task.FromResult(new AuthResponse(
            User: userDto,
            Tokens: new TokenDto("new_access_token", Guid.NewGuid().ToString(), 86400)
        ));
    }

    private AuthResponse GenerateAuthResponse(user user)
    {
        var (token, expiresIn) = CreateJwtToken(user);
        return new AuthResponse(
            User: MapToDto(user),
            Tokens: new TokenDto(token, Guid.NewGuid().ToString(), expiresIn)
        );
    }

    private static UserDto MapToDto(user user) => new(
        user.Id, user.Name, user.Email, user.Role, user.AvatarUrl, user.Rating, user.CreatedAtUtc, user.IsActive
    );

    private (string Token, int ExpiresIn) CreateJwtToken(user user)
    {
        var expiryMinutes = config.GetValue<int>("Jwt:ExpiryInMinutes", 1440);
        var expiration = DateTime.UtcNow.AddMinutes(expiryMinutes);

        var claims = new List<Claim> {
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
            expires: expiration,
            signingCredentials: creds
        );

        return (new JwtSecurityTokenHandler().WriteToken(token), expiryMinutes * 60);
    }

    private static bool IsValidEmail(string email)
    {
        try { return new System.Net.Mail.MailAddress(email).Address == email; }
        catch { return false; }
    }
}
