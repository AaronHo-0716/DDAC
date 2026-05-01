using System;

namespace backend.Models.Entities;

/// <summary>
/// Represents a withdrawal request submitted by a handyman to withdraw earned credits.
/// Workflow: handyman requests withdrawal → admin approves/rejects → admin marks as paid.
/// </summary>
public partial class Withdrawal_Request
{
    public Guid Id { get; set; }

    public Guid Handyman_User_Id { get; set; }

    public Guid Bank_Details_Id { get; set; }

    /// <summary>
    /// Amount requested for withdrawal
    /// </summary>
    public decimal Amount { get; set; }

    /// <summary>
    /// Snapshot of bank details at time of request (for audit trail and in case bank details are later updated)
    /// Stored as JSON with keys: bankName, accountName, accountNumber
    /// </summary>
    public string Bank_Details_Snapshot { get; set; } = "{}";

    /// <summary>
    /// Withdrawal request status: 'pending', 'approved', 'rejected', 'paid'
    /// </summary>
    public string Status { get; set; } = "pending";

    /// <summary>
    /// Reason provided by admin if withdrawal was rejected
    /// </summary>
    public string? Rejection_Reason { get; set; }

    /// <summary>
    /// ID of admin who approved this withdrawal request (if applicable)
    /// </summary>
    public Guid? Approved_By_User_Id { get; set; }

    /// <summary>
    /// Timestamp when admin approved this request
    /// </summary>
    public DateTime? Approved_At_Utc { get; set; }

    /// <summary>
    /// Timestamp when admin marked this as paid (actual payment sent)
    /// </summary>
    public DateTime? Paid_At_Utc { get; set; }

    /// <summary>
    /// ID of admin who marked this as paid
    /// </summary>
    public Guid? Paid_By_User_Id { get; set; }

    /// <summary>
    /// Optional: bank transfer reference number or transaction ID
    /// </summary>
    public string? Bank_Transfer_Reference { get; set; }

    /// <summary>
    /// Additional metadata (JSON: approver notes, payment method, etc.)
    /// </summary>
    public string Metadata { get; set; } = "{}";

    public DateTime Created_At_Utc { get; set; }

    public DateTime Updated_At_Utc { get; set; }

    // Navigation properties
    public virtual User Handyman_User { get; set; } = null!;

    public virtual Handyman_Bank_Details Bank_Details { get; set; } = null!;

    public virtual User? Approved_By_User { get; set; }

    public virtual User? Paid_By_User { get; set; }
}
