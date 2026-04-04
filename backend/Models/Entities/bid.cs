using System;
using System.Collections.Generic;

namespace backend.Models.Entities;

public partial class Bid
{
    public int Id { get; set; }

    public int Job_Id { get; set; }

    public int Handyman_User_Id { get; set; }

    public decimal Price { get; set; }

    public DateTime Estimated_Arrival_Utc { get; set; }

    public string Message { get; set; } = null!;

    public string Status { get; set; } = null!;

    public bool Is_Recommended { get; set; }

    public DateTime Created_At_Utc { get; set; }

    public DateTime Updated_At_Utc { get; set; }

    public virtual Bid_Lock? Bid_Lock { get; set; }

    public virtual ICollection<Bid_Transaction> Bid_Transactions { get; set; } = new List<Bid_Transaction>();

    public virtual User Handyman_User { get; set; } = null!;

    public virtual Job Job { get; set; } = null!;
}
