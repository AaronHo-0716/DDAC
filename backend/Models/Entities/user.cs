using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace backend.Models.Entities;

public partial class User
{
<<<<<<< HEAD
    [Key]
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; } = "homeowner";
    public bool IsActive { get; set; } = true; // Maps to account_status in SQL
    public bool Must_Reset_Password { get; set; }
    public string? AvatarUrl { get; set; }
    public decimal? Rating { get; set; }
    public string? Blocked_Reason { get; set; }
    public DateTime? Blocked_At_Utc { get; set; }
    public int? Blocked_By_User_Id { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime Updated_At_Utc { get; set; } = DateTime.UtcNow;

    public virtual ICollection<User> Inverse_Blocked_By_User { get; set; } = new List<User>();
    public virtual ICollection<Admin_Action> Admin_Actions { get; set; } = new List<Admin_Action>();
    public virtual ICollection<Bid_Lock> Bid_Locks { get; set; } = new List<Bid_Lock>();
    public virtual ICollection<Bid_Transaction> Bid_Transaction_Event_By_Users { get; set; } = new List<Bid_Transaction>();
    public virtual ICollection<Bid_Transaction> Bid_Transaction_Handyman_Users { get; set; } = new List<Bid_Transaction>();
    public virtual ICollection<Bid_Transaction> Bid_Transaction_Homeowner_Users { get; set; } = new List<Bid_Transaction>();
    public virtual ICollection<Bid> Bids { get; set; } = new List<Bid>();
    public virtual User? Blocked_By_User { get; set; }
    public virtual ICollection<Handyman_Verification> Handyman_Verification_Reviewed_By_Users { get; set; } = new List<Handyman_Verification>();
    public virtual Handyman_Verification? Handyman_Verification_User { get; set; }
    public virtual ICollection<Job> Jobs { get; set; } = new List<Job>();
    public virtual ICollection<Notification> Notifications { get; set; } = new List<Notification>();
    public virtual ICollection<Refresh_Token> Refresh_Tokens { get; set; } = new List<Refresh_Token>();
}
