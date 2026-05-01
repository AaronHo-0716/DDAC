using System;

namespace backend.Models.Entities;

/// <summary>
/// Represents a payment transaction after successful job completion and Stripe payment.
/// Tracks the full fee breakdown: SST (6%), homeowner platform fee (3%), handyman platform fee (3%).
/// </summary>
public partial class Payment
{
    public Guid Id { get; set; }

    public Guid Bid_Id { get; set; }

    public Guid Job_Id { get; set; }

    public Guid Homeowner_User_Id { get; set; }

    public Guid Handyman_User_Id { get; set; }

    /// <summary>
    /// The bid price as accepted (before fees)
    /// </summary>
    public decimal Bid_Amount { get; set; }

    /// <summary>
    /// 6% SST calculated on bid amount
    /// </summary>
    public decimal Sst_Amount { get; set; }

    /// <summary>
    /// 3% platform fee charged to homeowner
    /// </summary>
    public decimal Homeowner_Platform_Fee { get; set; }

    /// <summary>
    /// 3% platform fee deducted from handyman earnings
    /// </summary>
    public decimal Handyman_Platform_Fee { get; set; }

    /// <summary>
    /// Total amount homeowner pays: bid_amount + sst_amount + homeowner_platform_fee
    /// </summary>
    public decimal Homeowner_Total { get; set; }

    /// <summary>
    /// Amount credited to handyman: bid_amount - handyman_platform_fee
    /// </summary>
    public decimal Handyman_Credit { get; set; }

    /// <summary>
    /// Stripe checkout session ID
    /// </summary>
    public string? Stripe_Session_Id { get; set; }

    /// <summary>
    /// Stripe payment intent ID
    /// </summary>
    public string? Stripe_Payment_Intent_Id { get; set; }

    /// <summary>
    /// Payment status: 'initiated', 'paid'
    /// </summary>
    public string Status { get; set; } = "initiated";

    /// <summary>
    /// Additional payment metadata (JSON: session details, transaction IDs, etc.)
    /// </summary>
    public string Payment_Metadata { get; set; } = "{}";

    public DateTime Created_At_Utc { get; set; }

    public DateTime Updated_At_Utc { get; set; }

    // Navigation properties
    public virtual Bid Bid { get; set; } = null!;

    public virtual Job Job { get; set; } = null!;

    public virtual User Homeowner_User { get; set; } = null!;

    public virtual User Handyman_User { get; set; } = null!;
}
