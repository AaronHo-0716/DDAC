using System;
using System.Collections.Generic;

namespace backend.Models;

public partial class handyman_verification
{
    public Guid id { get; set; }

    public Guid user_id { get; set; }

    public Guid? reviewed_by_user_id { get; set; }

    public DateTime? reviewed_at_utc { get; set; }

    public string? notes { get; set; }

    public DateTime created_at_utc { get; set; }

    public DateTime updated_at_utc { get; set; }

    public virtual user? reviewed_by_user { get; set; }

    public virtual user user { get; set; } = null!;
}
