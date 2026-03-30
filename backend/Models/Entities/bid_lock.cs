using System;
using System.Collections.Generic;

namespace backend.Models.Entities;

public partial class Bid_Lock
{
    public Guid Bid_Id { get; set; }

    public Guid Locked_By_User_Id { get; set; }

    public string? Locked_Reason { get; set; }

    public DateTime Locked_At_Utc { get; set; }

    public virtual Bid Bid { get; set; } = null!;

    public virtual User Locked_By_User { get; set; } = null!;
}
