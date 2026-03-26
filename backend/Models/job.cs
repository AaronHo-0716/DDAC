using System;
using System.Collections.Generic;

namespace backend.Models;

public partial class job
{
    public Guid id { get; set; }

    public Guid posted_by_user_id { get; set; }

    public string title { get; set; } = null!;

    public string description { get; set; } = null!;

    public string location_text { get; set; } = null!;

    public decimal? latitude { get; set; }

    public decimal? longitude { get; set; }

    public decimal? budget { get; set; }

    public bool is_emergency { get; set; }

    public DateTime created_at_utc { get; set; }

    public DateTime updated_at_utc { get; set; }

    public virtual bid? bid { get; set; }

    public virtual ICollection<bid_transaction> bid_transactions { get; set; } = new List<bid_transaction>();

    public virtual ICollection<job_image> job_images { get; set; } = new List<job_image>();

    public virtual ICollection<notification> notifications { get; set; } = new List<notification>();

    public virtual user posted_by_user { get; set; } = null!;
}
