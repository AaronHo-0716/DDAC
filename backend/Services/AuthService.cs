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
        // 1. Basic Validation
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            throw new HttpRequestException("Email and password are required.", null, HttpStatusCode.BadRequest);

        var user = await context.Users.FirstOrDefaultAsync(u => u.Email == request.Email.ToLower().Trim());

        // 2. Verify Credentials (401 Unauthorized)
        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            throw new HttpRequestException("Invalid email or password.", null, HttpStatusCode.Unauthorized);

        return GenerateAuthResponse(user);
    }

    public async Task<AuthResponse> Register(RegisterRequest request)
    {
        // 1. Validate Required Fields (400 Bad Request)
        if (string.IsNullOrWhiteSpace(request.Email)) throw new HttpRequestException("Email is required.", null, HttpStatusCode.BadRequest);
        if (string.IsNullOrWhiteSpace(request.Password)) throw new HttpRequestException("Password is required.", null, HttpStatusCode.BadRequest);
        if (string.IsNullOrWhiteSpace(request.Name)) throw new HttpRequestException("Name is required.", null, HttpStatusCode.BadRequest);

        // 2. Validate Email Format (400 Bad Request)
        if (!IsValidEmail(request.Email))
            throw new HttpRequestException("The email format is invalid.", null, HttpStatusCode.BadRequest);

        // 3. Validate Password Length (400 Bad Request)
        if (request.Password.Length < 6)
            throw new HttpRequestException("Password must be at least 6 characters.", null, HttpStatusCode.BadRequest);

        // 4. Validate Role (400 Bad Request)
        var roleLower = request.Role?.ToLower().Trim();
        if (string.IsNullOrEmpty(roleLower) || !AllowedRoles.Contains(roleLower))
            throw new HttpRequestException($"Invalid role. Choose from: {string.Join(", ", AllowedRoles)}", null, HttpStatusCode.BadRequest);

        // 5. Check for Duplicate Email (409 Conflict)
        var emailLower = request.Email.ToLower().Trim();
        if (await context.Users.AnyAsync(u => u.Email == emailLower))
            throw new HttpRequestException("A user with this email already exists.", null, HttpStatusCode.Conflict);

        // 6. Create User
        var user = new User
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Email = emailLower,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = roleLower,
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
        if (user == null)
            throw new HttpRequestException("User not found.", null, HttpStatusCode.NotFound);
        return MapToDto(user);
    }

    public async Task<AuthResponse> RefreshToken(string token)
    {
        // MVP logic
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
        user.Role,
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

        var jwtKey = config["Jwt:Key"] ?? throw new Exception("JWT Key is missing from configuration.");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
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

    private static bool IsValidEmail(string email)
    {
        try
        {
            var addr = new System.Net.Mail.MailAddress(email);
            return addr.Address == email;
        }
        catch
        {
            return false;
        }
    }
}
