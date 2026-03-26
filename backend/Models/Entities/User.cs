namespace backend.Models.Entities;

public class User
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;

    // Roles should be "homeowner", "handyman", or "admin" to match frontend
    public string Role { get; set; } = "homeowner";

    public string? AvatarUrl { get; set; }
    public decimal? Rating { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
