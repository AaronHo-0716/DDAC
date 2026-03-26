using System;
using System.Collections.Generic;

namespace backend.Models;

public partial class notification
{
    public Guid id { get; set; }

    public Guid user_id { get; set; }

    public string message { get; set; } = null!;

    public Guid? related_job_id { get; set; }

    public bool is_read { get; set; }

    public DateTime created_at_utc { get; set; }

    public virtual job? related_job { get; set; }

    public virtual user user { get; set; } = null!;
}
