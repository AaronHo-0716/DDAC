using System;
using System.Collections.Generic;

namespace backend.Models.Entities;

public partial class bid_transaction
{
    public Guid id { get; set; }

    public Guid bid_id { get; set; }

    public Guid job_id { get; set; }

    public Guid handyman_user_id { get; set; }

    public Guid homeowner_user_id { get; set; }

    public string event_type { get; set; } = null!;

    public Guid? event_by_user_id { get; set; }

    public string? event_reason { get; set; }

    public string event_metadata { get; set; } = null!;

    public DateTime created_at_utc { get; set; }

    public virtual bid bid { get; set; } = null!;

    public virtual user? event_by_user { get; set; }

    public virtual user handyman_user { get; set; } = null!;

    public virtual user homeowner_user { get; set; } = null!;

    public virtual job job { get; set; } = null!;
}
