using System;
using System.Collections.Generic;

namespace backend.Models.Entities;

public partial class Admin_Action
{
    public int Id { get; set; }

    public int Admin_User_Id { get; set; }

    public string Action_Type { get; set; } = null!;

    public string Target_Type { get; set; } = null!;

    public int Target_Id { get; set; }

    public string? Reason { get; set; }

    public string Payload { get; set; } = null!;

    public DateTime Created_At_Utc { get; set; }

    public virtual User Admin_User { get; set; } = null!;
}
