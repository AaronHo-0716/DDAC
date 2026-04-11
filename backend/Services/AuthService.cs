using backend.Data;
using backend.Models.DTOs;
using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Net;
using System.Security.Cryptography;

namespace backend.Services;

public class AuthService(NeighbourHelpDbContext context, IConfiguration config) : IAuthService
{
    private static readonly string[] AllowedRoles = ["handyman", "homeowner", "admin"];

    public async Task<AuthResponse> Login(LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            throw new HttpRequestException("Email and password are required.", null, HttpStatusCode.BadRequest);

        var user = await context.Users
            .FirstOrDefaultAsync(u => u.Email == request.Email.ToLower().Trim());

        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            throw new HttpRequestException("Invalid email or password.", null, HttpStatusCode.Unauthorized);

        if (!user.IsActive)
        {
            var reason = string.IsNullOrEmpty(user.Blocked_Reason) ? "No reason provided by administrator." : user.Blocked_Reason;
            throw new HttpRequestException($"BLOCKED_USER_ERROR:{reason}", null, HttpStatusCode.BadRequest);
        }

        return await GenerateAuthResponse(user);
    }

    public async Task<AuthResponse> Register(RegisterRequest request)
    {
        if (!IsValidEmail(request.Email))
            throw new HttpRequestException("Invalid email format.", null, HttpStatusCode.BadRequest);

        var emailLower = request.Email.ToLower().Trim();
        if (await context.Users.AnyAsync(u => u.Email == emailLower))
            throw new HttpRequestException("Email already exists.", null, HttpStatusCode.Conflict);

        var roleLower = request.Role?.ToLower().Trim();
        if (string.IsNullOrEmpty(roleLower) || !AllowedRoles.Contains(roleLower))
        {
            throw new HttpRequestException($"Invalid role. Choose from: {string.Join(", ", AllowedRoles)}", null, HttpStatusCode.BadRequest);
        }

        var newUser = new User
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Email = emailLower,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = roleLower,  
            IsActive = true,
            TokenVersion = 1
        };

        context.Users.Add(newUser);
        await context.SaveChangesAsync();

        return await GenerateAuthResponse(newUser);
    }

    public async Task<AuthResponse> RefreshToken(string token)
    {
        var existingToken = await context.Refresh_Tokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Token_Hash == token);

        if (existingToken == null || !existingToken.IsActive)
            throw new HttpRequestException("Invalid or expired refresh token.", null, HttpStatusCode.Unauthorized);

        existingToken.User.TokenVersion++;
        var newRefreshTokenStr = GenerateSecureRandomString();
        existingToken.Revoked_At_Utc = DateTime.UtcNow;
        existingToken.Replaced_By_Token_Hash = newRefreshTokenStr;

        var newRefreshToken = new Refresh_Token {
            Id = Guid.NewGuid(), User_Id = existingToken.User_Id, Token_Hash = newRefreshTokenStr,
            Expires_At_Utc = DateTime.UtcNow.AddDays(7), Created_At_Utc = DateTime.UtcNow
        };

        context.Refresh_Tokens.Add(newRefreshToken);
        await context.SaveChangesAsync();

        var (accessToken, expiresIn) = CreateJwtToken(existingToken.User);
        return new AuthResponse(MapToDto(existingToken.User), new TokenDto(accessToken, newRefreshTokenStr, expiresIn));
    }

    public async Task Logout(LogoutRequest request, Guid userId)
    {
        var tokenEntry = await context.Refresh_Tokens
            .FirstOrDefaultAsync(t => t.Token_Hash == request.RefreshToken && t.User_Id == userId);

        if (tokenEntry != null) {
            tokenEntry.Revoked_At_Utc = DateTime.UtcNow;
            tokenEntry.Replaced_By_Token_Hash = "LOGOUT";
        }

        var user = await context.Users.FindAsync(userId);
        if (user != null) user.TokenVersion++;

        await context.SaveChangesAsync();
    }

    public async Task<UserDto> GetUserById(Guid userId)
    {
        var user = await context.Users.FindAsync(userId);
        if (user == null) throw new HttpRequestException("User not found.", null, HttpStatusCode.NotFound);
        return MapToDto(user);
    }

    private async Task<AuthResponse> GenerateAuthResponse(User user)
    {
        var (accessToken, expiresIn) = CreateJwtToken(user);
        var refreshTokenStr = GenerateSecureRandomString();
        var refreshToken = new Refresh_Token {
            Id = Guid.NewGuid(), User_Id = user.Id, Token_Hash = refreshTokenStr,
            Expires_At_Utc = DateTime.UtcNow.AddDays(7), Created_At_Utc = DateTime.UtcNow
        };
        context.Refresh_Tokens.Add(refreshToken);
        await context.SaveChangesAsync();
        return new AuthResponse(MapToDto(user), new TokenDto(accessToken, refreshTokenStr, expiresIn));
    }

    private (string Token, int ExpiresIn) CreateJwtToken(User user)
    {
        var claims = new List<Claim> {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Role, user.Role.Trim()),
            new("TokenVersion", user.TokenVersion.ToString()) 
        };
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!));
        var token = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"], audience: config["Jwt:Audience"], claims: claims,
            expires: DateTime.UtcNow.AddMinutes(config.GetValue<int>("Jwt:ExpiryInMinutes", 60)),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
        );
        return (new JwtSecurityTokenHandler().WriteToken(token), 3600);
    }

    private string GenerateSecureRandomString()
    {
        var randomNumber = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomNumber);
        return Convert.ToBase64String(randomNumber);
    }

    private static UserDto MapToDto(User user) => new(
        user.Id, 
        user.Name.Trim(), 
        user.Email.Trim(), 
        user.Role.Trim(), 
        user.AvatarUrl, 
        user.Rating, 
        user.CreatedAtUtc, 
        user.IsActive,
        user.Blocked_Reason,
        user.Blocked_At_Utc
    );

    private static bool IsValidEmail(string email)
    {
        try { return new System.Net.Mail.MailAddress(email).Address == email; }
        catch { return false; }
    }
}
