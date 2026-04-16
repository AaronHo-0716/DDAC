namespace backend.Models.Entities;

public partial class User_Rating
{
    public Guid Id { get; set; }
    public Guid RaterUserId { get; set; }
    public Guid TargetUserId { get; set; }
    public int Score { get; set; }
    public string? Comment { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;

    public virtual User RaterUser { get; set; } = null!;
    public virtual User TargetUser { get; set; } = null!;
}