using System;
using System.Collections.Generic;

namespace backend.Models.Entities;

// Note: Keeping lowercase 'user' as requested, ignoring CS8981 warning
public partial class user
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; } = "homeowner";
    public bool IsActive { get; set; } = true; // Maps to account_status in SQL
    public bool must_reset_password { get; set; }
    public string? AvatarUrl { get; set; }
    public decimal? Rating { get; set; }
    public string? blocked_reason { get; set; }
    public DateTime? blocked_at_utc { get; set; }
    public Guid? blocked_by_user_id { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime updated_at_utc { get; set; } = DateTime.UtcNow;

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
