using System;
using System.Collections.Generic;

namespace backend.Models.Entities;

public partial class Handyman_Verification
{
    public Guid Id { get; set; }

    public Guid User_Id { get; set; }

    public string Status { get; set; } = null!;

    public Guid? Reviewed_By_User_Id { get; set; }

    public DateTime? Reviewed_At_Utc { get; set; }

    public string? Notes { get; set; }

    public DateTime Created_At_Utc { get; set; }

    public DateTime Updated_At_Utc { get; set; }

    public virtual User? Reviewed_By_User { get; set; }

    public virtual User User { get; set; } = null!;
}
