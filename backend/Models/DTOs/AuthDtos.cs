namespace backend.Models.DTOs;

// The "User" object in frontend types
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

// The "tokens" object in frontend types
public record TokenDto(
    string AccessToken,
    string RefreshToken,
    int ExpiresIn
);

// The root response for Login/Register/Refresh
public record AuthResponse(
    UserDto User,
    TokenDto Tokens
);

// Request models
public record LoginRequest(string Email, string Password);
public record RegisterRequest(string Name, string Email, string Password, string Role);
public record RefreshRequest(string RefreshToken);
