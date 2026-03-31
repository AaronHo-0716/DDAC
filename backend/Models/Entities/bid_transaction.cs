using System;
using System.Collections.Generic;

namespace backend.Models.Entities;

public partial class Bid_Transaction
{
    public int Id { get; set; }

    public int Bid_Id { get; set; }

    public int Job_Id { get; set; }

    public int Handyman_User_Id { get; set; }

    public int Homeowner_User_Id { get; set; }

    public string Event_Type { get; set; } = null!;

    public int? Event_By_User_Id { get; set; }

    public string? Event_Reason { get; set; }

    public string Event_Metadata { get; set; } = null!;

    public DateTime Created_At_Utc { get; set; }

    public virtual Bid Bid { get; set; } = null!;

    public virtual User? Event_By_User { get; set; }

    public virtual User Handyman_User { get; set; } = null!;

    public virtual User Homeowner_User { get; set; } = null!;

    public virtual Job Job { get; set; } = null!;
}
