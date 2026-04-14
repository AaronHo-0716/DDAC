using backend.Data;
using backend.Models.DTOs;
using backend.Models.Entities;
using backend.Constants;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Net;
using System.Security.Cryptography;

namespace backend.Services;

public class AuthService( NeighbourHelpDbContext context, IConfiguration config, ILogger<AuthService> logger) : BaseService(context, logger), IAuthService
{
    public async Task<AuthResponse> Login(LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            throw new HttpRequestException("Email and password are required.", null, HttpStatusCode.BadRequest);

        var user = await context.Users.FirstOrDefaultAsync(u => u.Email == request.Email.ToLower().Trim());

        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            logger.LogWarning("Failed login attempt for email: {Email}", request.Email);
            throw new HttpRequestException("Invalid email or password.", null, HttpStatusCode.Unauthorized);
        }

        if (!user.IsActive)
        {
            logger.LogInformation("Blocked user {UserId} attempted login.", user.Id);
            return new AuthResponse(await MapUserToDto(user), new TokenDto(string.Empty, string.Empty, 0));
        }

        return await GenerateAuthResponse(user);
    }

    public async Task<AuthResponse> Register(RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Name))
            throw new HttpRequestException("Email and Name are required.", null, HttpStatusCode.BadRequest);

        if (!IsValidEmail(request.Email))
            throw new HttpRequestException("Invalid email format.", null, HttpStatusCode.BadRequest);

        var emailLower = request.Email.ToLower().Trim();
        if (await context.Users.AnyAsync(u => u.Email == emailLower))
            throw new HttpRequestException("A user with this email already exists.", null, HttpStatusCode.Conflict);

        if (!Enum.TryParse<UserRole>(request.Role, true, out var roleEnum) || roleEnum == UserRole.Admin)
            throw new HttpRequestException("Invalid role selected.", null, HttpStatusCode.BadRequest);

        var newUser = new User
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Email = emailLower,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = roleEnum.ToDbString(),
            IsActive = true,
            TokenVersion = 1
        };

        context.Users.Add(newUser);

        if (roleEnum == UserRole.Handyman)
        {
            // 1. Create the verification record
            context.Handyman_Verifications.Add(new Handyman_Verification
            {
                Id = Guid.NewGuid(),
                User_Id = newUser.Id,
                Status = VerificationStatus.Pending.ToDbString(),
                Created_At_Utc = DateTime.UtcNow,
                Updated_At_Utc = DateTime.UtcNow
            });

            // 2. Send Notification to all Admins
            await CreateNotifications(
                            NotificationType.NewHandymanRegistration, 
                            $"New handyman registration: {newUser.Name} requires verification."
                        );
        }

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
            Id = Guid.NewGuid(), 
            User_Id = existingToken.User_Id, 
            Token_Hash = newRefreshTokenStr,
            Expires_At_Utc = DateTime.UtcNow.AddDays(AuthConstants.RefreshTokenExpiryDays), 
            Created_At_Utc = DateTime.UtcNow
        };

        context.Refresh_Tokens.Add(newRefreshToken);
        await context.SaveChangesAsync();

        var (accessToken, expiresIn) = CreateJwtToken(existingToken.User);
        return new AuthResponse(await MapUserToDto(existingToken.User), new TokenDto(accessToken, newRefreshTokenStr, expiresIn));
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
        var user = await context.Users.FindAsync(userId) 
            ?? throw new HttpRequestException("User not found.", null, HttpStatusCode.NotFound);
        return await MapUserToDto(user);
    }

    private (string Token, int ExpiresIn) CreateJwtToken(User user)
    {
        var claims = new List<Claim> {
            // new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Name, user.Name),
            new(ClaimTypes.Role, user.Role),
            new("TokenVersion", user.TokenVersion.ToString()) 

        };
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!));
        var expiryMinutes = config.GetValue<int>("Jwt:ExpiryInMinutes", AuthConstants.DefaultJwtExpiryMinutes);
        var token = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"], 
            audience: config["Jwt:Audience"], 
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expiryMinutes),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
        );
        return (new JwtSecurityTokenHandler().WriteToken(token), expiryMinutes * 60);
    }

    private async Task<AuthResponse> GenerateAuthResponse(User user)
    {
        var (accessToken, expiresIn) = CreateJwtToken(user);
        var refreshTokenStr = GenerateSecureRandomString();
        context.Refresh_Tokens.Add(new Refresh_Token {
            Id = Guid.NewGuid(), 
            User_Id = user.Id, 
            Token_Hash = refreshTokenStr,
            Expires_At_Utc = DateTime.UtcNow.AddDays(AuthConstants.RefreshTokenExpiryDays), 
            Created_At_Utc = DateTime.UtcNow
        });
        await context.SaveChangesAsync();
        return new AuthResponse(await MapUserToDto(user), new TokenDto(accessToken, refreshTokenStr, expiresIn));
    }

    private string GenerateSecureRandomString()
    {
        var randomNumber = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomNumber);
        return Convert.ToBase64String(randomNumber);
    }
}
