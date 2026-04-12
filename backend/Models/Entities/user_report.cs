using System;
using System.ComponentModel.DataAnnotations;

namespace backend.Models.Entities;

public partial class User_Report
{
    [Key]
    public Guid Id { get; set; }

    public Guid Reporter_Id { get; set; }

    public Guid Target_User_Id { get; set; }

    public string Reason { get; set; } = null!;

    public string Description { get; set; } = null!;

    public string Status { get; set; } = "pending"; // pending, reviewed, resolved

    public Guid? Reviewed_By_Admin_Id { get; set; }

    public DateTime? Reviewed_At_Utc { get; set; }

    public string? Admin_Notes { get; set; }

    public DateTime Created_At_Utc { get; set; } = DateTime.UtcNow;

    public virtual User Reporter { get; set; } = null!;
    public virtual User Target_User { get; set; } = null!;
    public virtual User? Reviewed_By_Admin { get; set; }
}
