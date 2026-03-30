namespace backend.Models.DTOs;

public enum UserRoleFilter
{
    Handyman,
    Homeowner,
    Admin
}

public record UserSearchRequest(
    string? Name,      // Separate column for Name
    string? Email,     // Separate column for "User" (Email)
    UserRoleFilter? Role, // This will become a dropdown
    bool? IsActive
);
