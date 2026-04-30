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

public class AuthService(ServiceDependencies deps, IConfiguration config) : BaseService(deps), IAuthService
{
    public async Task<AuthResponse> Login(LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            throw new HttpRequestException("Email and password are required.", null, HttpStatusCode.BadRequest);

        var user = await Context.Users.FirstOrDefaultAsync(u => u.Email == request.Email.ToLower().Trim());

        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            Logger.LogWarning("Failed login attempt for email: {Email}", request.Email);
            throw new HttpRequestException("Invalid email or password.", null, HttpStatusCode.Unauthorized);
        }

        if (!user.IsActive)
        {
            Logger.LogInformation("Blocked user {UserId} attempted login.", user.Id);
            throw new HttpRequestException("Access denied. The account is blocked.", null, HttpStatusCode.Forbidden);
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
        if (await Context.Users.AnyAsync(u => u.Email == emailLower))
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
            TokenVersion = 1,
            Email_Verified = false
        };

        Context.Users.Add(newUser);

        if (roleEnum == UserRole.Handyman)
        {
            await SaveHandymanVerificationToDb(newUser);

            await CreateNotifications(
                NotificationType.NewHandymanRegistration, 
                $"New handyman registration: {newUser.Name} requires verification."
            );
        }

        await Context.SaveChangesAsync();
        return await GenerateAuthResponse(newUser);
    }

    public async Task<HandymanVerificationDto> CreateHandymanVerification()
    {
        var userId = await GetCurrentUserIdAsync(); 

        var user = await Context.Users
            .Include(u => u.Handyman_Verification_User) 
            .FirstOrDefaultAsync(u => u.Id == userId)
            ?? throw new HttpRequestException("User not found.", null, HttpStatusCode.NotFound);

        if (user.Handyman_Verification_User?.Status == VerificationStatus.Approved.ToDbString()) 
            throw new HttpRequestException("Cannot make new verification once a Handyman account has been approved. Please contact support for assistance.", null, HttpStatusCode.BadRequest);

        var response = await SaveHandymanVerificationToDb(user);

        await CreateNotifications(
                NotificationType.ResubmitVerification, 
                $"Handyman {user.Name} has resubmitted their verification."
            );
        
        return response;
    }

    private async Task<HandymanVerificationDto> SaveHandymanVerificationToDb(User user)
    {
        var handyman = new Handyman_Verification
        {
            Id = Guid.NewGuid(),
            User_Id = user.Id,
            Status = VerificationStatus.Pending.ToDbString(),
            Created_At_Utc = DateTime.UtcNow,
            Updated_At_Utc = DateTime.UtcNow
        };
        Context.Handyman_Verifications.Add(handyman);
        await Context.SaveChangesAsync();
        return MapPendingToDto(handyman);
    }

    public async Task<AuthResponse> RefreshToken(string token)
    {
        var existingToken = await Context.Refresh_Tokens
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

        Context.Refresh_Tokens.Add(newRefreshToken);
        await Context.SaveChangesAsync();

        var (accessToken, expiresIn) = CreateJwtToken(existingToken.User);
        return new AuthResponse(await MapUserToDto(existingToken.User), new TokenDto(accessToken, newRefreshTokenStr, expiresIn));
    }

    public async Task Logout(LogoutRequest request)
    {
        var userId = await GetCurrentUserIdAsync(); 

        var tokenEntry = await Context.Refresh_Tokens
            .FirstOrDefaultAsync(t => t.Token_Hash == request.RefreshToken && t.User_Id == userId);

        if (tokenEntry != null) {
            tokenEntry.Revoked_At_Utc = DateTime.UtcNow;
            tokenEntry.Replaced_By_Token_Hash = "LOGOUT";
        }

        var user = await Context.Users.FindAsync(userId);
        if (user != null) user.TokenVersion++;

        await Context.SaveChangesAsync();
    }

    public async Task<string> ForgotPasswordAsync(string email)
    {
        var emailClean = email.ToLower().Trim();
        var user = await Context.Users.FirstOrDefaultAsync(u => u.Email == emailClean) ??
            throw new HttpRequestException("Unable to process password reset request. Please try again or contact support if the issue persists.", null, HttpStatusCode.Forbidden);

        string resetToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        
        user.PasswordResetToken = resetToken;
        user.ResetTokenExpiresUtc = DateTime.UtcNow.AddHours(2);

        await Context.SaveChangesAsync();

        var resetUrl = $"{FrontendUrl}/reset-password?token={resetToken}&email={Uri.EscapeDataString(user.Email)}";

        await Email.SendEmailAsync(user.Email, "Reset Your Password", 
            $@"<div style='font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;'>
                <h2>Password Reset Request</h2>
                <p>We received a request to reset your password. Click the button below to choose a new one:</p>
                <div style='text-align: center; margin: 30px 0;'>
                    <a href='{resetUrl}' style='background-color: #0B74FF; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;'>Reset Password</a>
                </div>
                <p style='color: #666; font-size: 12px;'>If you didn't request this, you can safely ignore this email. This link will expire in 2 hours.</p>
                <hr style='border: none; border-top: 1px solid #eee;' />
                <p style='color: #999; font-size: 11px;'>If the button doesn't work, copy and paste this link: <br/>{resetUrl}</p>
            </div>");

        Logger.LogInformation("Password reset link sent to {Email}", user.Email);
        return resetToken;
    }

    public async Task<AuthResponse> ResetPasswordAsync(ResetPasswordRequest req)
    {
        var user = await Context.Users.FirstOrDefaultAsync(u => 
            u.PasswordResetToken == req.Token && 
            u.ResetTokenExpiresUtc > DateTime.UtcNow)
            ?? throw new HttpRequestException("The reset link is invalid or has expired.", null, HttpStatusCode.BadRequest);

        if (BCrypt.Net.BCrypt.Verify(req.NewPassword, user.PasswordHash))
            throw new HttpRequestException("New password cannot be the same as current.", null, HttpStatusCode.BadRequest);

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);

        user.PasswordResetToken = null;
        user.ResetTokenExpiresUtc = null;
        user.TokenVersion++;

        await Context.SaveChangesAsync();
        
        Logger.LogInformation("Password successfully reset for User {UserId} via email token.", user.Id);
        return await GenerateAuthResponse(user);
    }

    public async Task<AuthResponse> ChangePasswordAsync(ChangePasswordRequest req)
    {
        var userId = await GetCurrentUserIdAsync();
        var user = await Context.Users.FindAsync(userId) 
            ?? throw new HttpRequestException("User not found.", null, HttpStatusCode.NotFound);

        await ValidateOtpInternal(user.Email, req.Otp);

        if (!BCrypt.Net.BCrypt.Verify(req.OldPassword, user.PasswordHash))
            throw new HttpRequestException("Current password is incorrect.", null, HttpStatusCode.Unauthorized);

        if (BCrypt.Net.BCrypt.Verify(req.NewPassword, user.PasswordHash))
            throw new HttpRequestException("New password cannot be the same as current.", null, HttpStatusCode.BadRequest);

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
        user.TokenVersion++; 
        
        ClearOtp(user); 
        await Context.SaveChangesAsync();
        return await GenerateAuthResponse(user);
    }
    
    public async Task SendOtpAsync(string email, EmailPurpose purpose)
    {
        var user = await Context.Users.FirstOrDefaultAsync(u => u.Email == email.ToLower().Trim())
            ?? throw new HttpRequestException("User not found.", null, HttpStatusCode.NotFound);

        // Generate secure 6-digit OTP
        string otp = RandomNumberGenerator.GetInt32(100000, 999999).ToString();
        
        user.Email_Otp = otp;
        user.Otp_Expiry_Utc = DateTime.UtcNow.AddMinutes(15);

        await Context.SaveChangesAsync();

        // Subject logic using Enum
        string subject = (purpose == EmailPurpose.PasswordReset) 
            ? "Reset Your Password" 
            : "Verify Your Email";
        
        await Email.SendEmailAsync(user.Email, subject, 
            $@"<div style='text-align: center; font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;'>
                <h2 style='color: #333;'>{subject}</h2>
                <p style='color: #666;'>Use the 6-digit code below to proceed. This code expires in 15 minutes.</p>
                <h1 style='color: #0B74FF; letter-spacing: 8px; font-size: 40px;'>{otp}</h1>
                <p style='color: #999; font-size: 12px;'>If you did not request this, please ignore this email.</p>
            </div>");

        Logger.LogInformation("OTP ({Purpose}) sent successfully to {Email}", purpose, email);
    }

    public async Task<UserDto> GetUserById()
    {
        var userId = await GetCurrentUserIdAsync(); 
        var user = await Context.Users.FindAsync(userId) 
            ?? throw new HttpRequestException("User not found.", null, HttpStatusCode.NotFound);
        return await MapUserToDto(user);
    }

    private async Task<User> ValidateOtpInternal(string email, string otp)
    {
        var user = await Context.Users.FirstOrDefaultAsync(u => u.Email == email.ToLower().Trim())
            ?? throw new HttpRequestException("User not found.", null, HttpStatusCode.NotFound);

        if (string.IsNullOrEmpty(user.Email_Otp) || user.Email_Otp != otp)
            throw new HttpRequestException("The verification code provided is invalid.", null, HttpStatusCode.BadRequest);

        if (user.Otp_Expiry_Utc < DateTime.UtcNow)
            throw new HttpRequestException("The verification code has expired. Please request a new one.", null, HttpStatusCode.BadRequest);

        return user;
    }
    private void ClearOtp(User user)
    {
        user.Email_Otp = null;
        user.Otp_Expiry_Utc = null;
    }

    private (string Token, int ExpiresIn) CreateJwtToken(User user)
    {
        var claims = new List<Claim> {
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
        
        Context.Refresh_Tokens.Add(new Refresh_Token {
            Id = Guid.NewGuid(), 
            User_Id = user.Id, 
            Token_Hash = refreshTokenStr,
            Expires_At_Utc = DateTime.UtcNow.AddDays(AuthConstants.RefreshTokenExpiryDays), 
            Created_At_Utc = DateTime.UtcNow
        });

        await Context.SaveChangesAsync();
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
