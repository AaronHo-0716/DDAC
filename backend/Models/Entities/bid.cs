using System;
using System.Collections.Generic;

namespace backend.Models.Entities;

public partial class bid
{
    public Guid id { get; set; }

    public Guid job_id { get; set; }

    public Guid handyman_user_id { get; set; }

    public decimal price { get; set; }

    public DateTime estimated_arrival_utc { get; set; }

    public string message { get; set; } = null!;

    public string status { get; set; } = null!;

    public bool is_recommended { get; set; }

    public DateTime created_at_utc { get; set; }

    public DateTime updated_at_utc { get; set; }

    public virtual bid_lock? bid_lock { get; set; }

    public virtual ICollection<bid_transaction> bid_transactions { get; set; } = new List<bid_transaction>();

    public virtual user handyman_user { get; set; } = null!;

    public virtual job job { get; set; } = null!;
}
