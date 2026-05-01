using System;
using System.Collections.Generic;

namespace backend.Models.Entities;

/// <summary>
/// Stores handyman bank account details and verification status.
/// Admin must verify bank details (by reviewing screenshot proof) before handyman can request withdrawal.
/// </summary>
public partial class Handyman_Bank_Details
{
    public Guid Id { get; set; }

    public Guid Handyman_User_Id { get; set; }

    /// <summary>
    /// Bank institution name (e.g., "Maybank", "CIMB")
    /// </summary>
    public string Bank_Name { get; set; } = null!;

    /// <summary>
    /// Account holder name (as shown on bank account)
    /// </summary>
    public string Account_Name { get; set; } = null!;

    /// <summary>
    /// Bank account number (numeric only, masked in responses for security)
    /// </summary>
    public string Account_Number { get; set; } = null!;

    /// <summary>
    /// Verification status: 'unverified', 'verified', 'rejected', 'disabled'
    /// </summary>
    public string Verification_Status { get; set; } = "unverified";

    /// <summary>
    /// S3 URL or storage path to bank statement screenshot proof
    /// </summary>
    public string? Bank_Statement_Proof_Url { get; set; }

    /// <summary>
    /// Admin notes on why verification was rejected (if applicable)
    /// </summary>
    public string? Rejection_Reason { get; set; }

    /// <summary>
    /// User ID of admin who reviewed this bank details
    /// </summary>
    public Guid? Verified_By_User_Id { get; set; }

    /// <summary>
    /// Timestamp when admin verified or rejected this bank details
    /// </summary>
    public DateTime? Verified_At_Utc { get; set; }

    public DateTime Created_At_Utc { get; set; }

    public DateTime Updated_At_Utc { get; set; }

    // Navigation properties
    public virtual User Handyman_User { get; set; } = null!;

    public virtual User? Verified_By_User { get; set; }

    public virtual ICollection<Withdrawal_Request> Withdrawal_Requests { get; set; } = new List<Withdrawal_Request>();
}
