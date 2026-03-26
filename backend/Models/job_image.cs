using System;
using System.Collections.Generic;

namespace backend.Models;

public partial class job_image
{
    public Guid id { get; set; }

    public Guid job_id { get; set; }

    public string image_url { get; set; } = null!;

    public string object_key { get; set; } = null!;

    public int sort_order { get; set; }

    public DateTime created_at_utc { get; set; }

    public virtual job job { get; set; } = null!;
}
