namespace backend.Models.DTOs;

public enum UserRoleFilter
{
    Handyman,
    Homeowner,
    Admin
}

public record UserSearchRequest(
    string? Name,
    string? Email,
    UserRoleFilter? Role,
    bool? IsActive
);
