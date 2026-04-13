using backend.Data;
using backend.Models.DTOs;
using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Net;
using System.Security.Cryptography;

namespace backend.Services;

public class AuthService(NeighbourHelpDbContext context, IConfiguration config, ILogger<AuthService> logger) : IAuthService
{
    private static readonly string[] AllowedRoles = ["handyman", "homeowner"];

    public async Task<AuthResponse> Login(LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            throw new HttpRequestException("Email and password are required.", null, HttpStatusCode.BadRequest);

        var user = await context.Users
            .FirstOrDefaultAsync(u => u.Email == request.Email.ToLower().Trim());

        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            logger.LogWarning("Failed login attempt for email: {Email}", request.Email);
            throw new HttpRequestException("Invalid email or password.", null, HttpStatusCode.Unauthorized);
        }

        if (!user.IsActive)
        {
            logger.LogInformation("Blocked user {UserId} attempted login.", user.Id);
            var reason = string.IsNullOrEmpty(user.Blocked_Reason) ? "No reason provided by administrator." : user.Blocked_Reason;
            throw new HttpRequestException($"BLOCKED_USER_ERROR:{reason}", null, HttpStatusCode.BadRequest);
        }

        logger.LogInformation("User {Email} logged in successfully.", user.Email);
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

        if (roleLower == AllowedRoles[0])
        {
            // 1. Create Verification Record
            context.Handyman_Verifications.Add(new Handyman_Verification
            {
                Id = Guid.NewGuid(),
                User_Id = newUser.Id,
                Status = "pending",
                Created_At_Utc = DateTime.UtcNow,
                Updated_At_Utc = DateTime.UtcNow
            });
    
            // 2. Optimized Batch Notification for all Admins
            var adminIds = await context.Users
                .Where(u => u.Role == "admin")
                .Select(u => u.Id)
                .ToListAsync();
    
            if (adminIds.Any())
            {
                var adminNotifications = adminIds.Select(adminId => new Notification
                {
                    Id = Guid.NewGuid(),
                    User_Id = adminId,
                    Type = "new_handyman_registration",
                    Message = $"New handyman {newUser.Name} requires verification.",
                    Is_Read = false,
                    Created_At_Utc = DateTime.UtcNow
                });
    
                context.Notifications.AddRange(adminNotifications);
            }
        }

        await context.SaveChangesAsync();

        logger.LogInformation("New user registered: {UserId} with role {Role}", newUser.Id, newUser.Role);
        return await GenerateAuthResponse(newUser);
    }

    public async Task<AuthResponse> RefreshToken(string token)
    {
        var existingToken = await context.Refresh_Tokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Token_Hash == token);

        if (existingToken == null || !existingToken.IsActive)
        {
            logger.LogWarning("Invalid or expired refresh token used.");
            throw new HttpRequestException("Invalid or expired refresh token.", null, HttpStatusCode.Unauthorized);
        }

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

        logger.LogInformation("Token rotated for user {UserId}", existingToken.User_Id);
        var (accessToken, expiresIn) = CreateJwtToken(existingToken.User);
        return new AuthResponse(await MapToDto(existingToken.User), new TokenDto(accessToken, newRefreshTokenStr, expiresIn));
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
        if (user != null)
        {
            user.TokenVersion++;
            logger.LogInformation("User {UserId} logged out. Token version incremented.", userId);
        }

        await context.SaveChangesAsync();
    }

    public async Task<UserDto> GetUserById(Guid userId)
    {
        var user = await context.Users.FindAsync(userId);
        if (user == null) throw new HttpRequestException("User not found.", null, HttpStatusCode.NotFound);
        return await MapToDto(user);
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
        return new AuthResponse(await MapToDto(user), new TokenDto(accessToken, refreshTokenStr, expiresIn));
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

    private async Task<UserDto> MapToDto(User user)
    {
        string verificationStatus = "approved";
        
        if (user.Role == "handyman")
        {
            verificationStatus = await context.Handyman_Verifications
                .Where(v => v.User_Id == user.Id)
                .Select(v => v.Status)
                .FirstOrDefaultAsync() ?? "pending";
        }

        return new UserDto(
            user.Id, 
            user.Name.Trim(), 
            user.Email.Trim(), 
            user.Role.Trim(), 
            user.AvatarUrl, 
            user.Rating, 
            user.CreatedAtUtc, 
            user.IsActive,
            verificationStatus, 
            user.Blocked_Reason,
            user.Blocked_At_Utc
        );
    }

    private static bool IsValidEmail(string email)
    {
        try { return new System.Net.Mail.MailAddress(email).Address == email; }
        catch { return false; }
    }
}
