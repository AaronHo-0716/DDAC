namespace backend.Models.DTOs;

public record UserDto(
    Guid Id,
    string Name,
    string Email,
    string Role, // "homeowner", "handyman", or "admin"
    string? AvatarUrl,
    decimal? Rating,
    DateTime CreatedAt,
    bool IsActive = true
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

public record LoginRequest(string Email, string Password);
public record RegisterRequest(string Name, string Email, string Password, string Role);
public record RefreshRequest(string RefreshToken);
