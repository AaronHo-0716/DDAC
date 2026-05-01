using System;

namespace backend.Models.Entities;

/// <summary>
/// Represents a credit transaction for a handyman.
/// Each completed job that is paid generates one credit transaction entry (transaction-based ledger).
/// This ensures a full audit trail of all credit movements.
/// </summary>
public partial class Handyman_Credit
{
    public Guid Id { get; set; }

    public Guid Handyman_User_Id { get; set; }

    /// <summary>
    /// Transaction type: 'earned' (from payment), 'withdrawn' (from withdrawal request)
    /// </summary>
    public string Transaction_Type { get; set; } = null!;

    /// <summary>
    /// Amount in this transaction (positive value; direction determined by transaction_type)
    /// </summary>
    public decimal Amount { get; set; }

    /// <summary>
    /// Short description of the credit movement (e.g., "Payment for Job: Plumbing Repair", "Withdrawal request approved")
    /// </summary>
    public string Description { get; set; } = null!;

    /// <summary>
    /// Reference to the Payment record if this is an 'earned' transaction
    /// </summary>
    public Guid? Related_Payment_Id { get; set; }

    /// <summary>
    /// Reference to the Job associated with this credit
    /// </summary>
    public Guid? Related_Job_Id { get; set; }

    /// <summary>
    /// Reference to the Bid associated with this credit
    /// </summary>
    public Guid? Related_Bid_Id { get; set; }

    /// <summary>
    /// Reference to the WithdrawalRequest if this is a 'withdrawn' transaction
    /// </summary>
    public Guid? Related_Withdrawal_Request_Id { get; set; }

    /// <summary>
    /// Running balance after this transaction (for quick audit trail reading)
    /// </summary>
    public decimal Balance_After { get; set; }

    public DateTime Created_At_Utc { get; set; }

    // Navigation properties
    public virtual User Handyman_User { get; set; } = null!;

    public virtual Payment? Related_Payment { get; set; }

    public virtual Job? Related_Job { get; set; }

    public virtual Bid? Related_Bid { get; set; }

    public virtual Withdrawal_Request? Related_Withdrawal_Request { get; set; }
}
