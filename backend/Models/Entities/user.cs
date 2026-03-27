using System;
using System.Collections.Generic;

namespace backend.Models.Entities;

public partial class user
{
    public Guid id { get; set; }

    public string name { get; set; } = null!;

    public string email { get; set; } = null!;

    public string password_hash { get; set; } = null!;

    public string role { get; set; } = null!;

    public string account_status { get; set; } = null!;

    public bool must_reset_password { get; set; }

    public string? avatar_url { get; set; }

    public decimal? rating { get; set; }

    public string? blocked_reason { get; set; }

    public DateTime? blocked_at_utc { get; set; }

    public Guid? blocked_by_user_id { get; set; }

    public DateTime created_at_utc { get; set; }

    public DateTime updated_at_utc { get; set; }

    public virtual ICollection<user> Inverseblocked_by_user { get; set; } = new List<user>();

    public virtual ICollection<admin_action> admin_actions { get; set; } = new List<admin_action>();

    public virtual ICollection<bid_lock> bid_locks { get; set; } = new List<bid_lock>();

    public virtual ICollection<bid_transaction> bid_transactionevent_by_users { get; set; } = new List<bid_transaction>();

    public virtual ICollection<bid_transaction> bid_transactionhandyman_users { get; set; } = new List<bid_transaction>();

    public virtual ICollection<bid_transaction> bid_transactionhomeowner_users { get; set; } = new List<bid_transaction>();

    public virtual ICollection<bid> bids { get; set; } = new List<bid>();

    public virtual user? blocked_by_user { get; set; }

    public virtual ICollection<handyman_verification> handyman_verificationreviewed_by_users { get; set; } = new List<handyman_verification>();

    public virtual handyman_verification? handyman_verificationuser { get; set; }

    public virtual ICollection<job> jobs { get; set; } = new List<job>();

    public virtual ICollection<notification> notifications { get; set; } = new List<notification>();

    public virtual ICollection<refresh_token> refresh_tokens { get; set; } = new List<refresh_token>();
}
