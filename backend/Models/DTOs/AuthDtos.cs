using System;

namespace backend.Models.DTOs;

public record UserDto(
    Guid Id,
    string Name,
    string Email,
    string Role, 
    string? AvatarUrl,
    decimal? Rating,
    DateTime CreatedAt,
    bool IsActive = true,
    string Verification = "approved",
    string? BlockedReason = null,
    DateTime? BlockedAtUtc = null
);

public record TokenDto(
    string AccessToken,
    string RefreshToken,
    int ExpiresIn
);

public record AuthResponse(
    UserDto User,
    TokenDto Tokens
);

public record BlockedUserResponse(
    string Message,
    string Reason,
    DateTime? BlockedAt
);

public record LoginRequest(string Email, string Password);
public record RegisterRequest(string Name, string Email, string Password, string Role);
public record RefreshRequest(string RefreshToken);
public record LogoutRequest(string RefreshToken);
