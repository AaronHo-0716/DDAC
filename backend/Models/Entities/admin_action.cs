using System;
using System.Collections.Generic;

namespace backend.Models.Entities;

public partial class admin_action
{
    public Guid id { get; set; }

    public Guid admin_user_id { get; set; }

    public string action_type { get; set; } = null!;

    public string target_type { get; set; } = null!;

    public Guid target_id { get; set; }

    public string? reason { get; set; }

    public string payload { get; set; } = null!;

    public DateTime created_at_utc { get; set; }

    public virtual user admin_user { get; set; } = null!;
}
