using System;
using System.Collections.Generic;

namespace backend.Models;

public partial class bid_lock
{
    public Guid bid_id { get; set; }

    public Guid locked_by_user_id { get; set; }

    public string? locked_reason { get; set; }

    public DateTime locked_at_utc { get; set; }

    public virtual bid bid { get; set; } = null!;

    public virtual user locked_by_user { get; set; } = null!;
}
