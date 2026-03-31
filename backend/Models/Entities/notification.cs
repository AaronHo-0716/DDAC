using System;
using System.Collections.Generic;

namespace backend.Models.Entities;

public partial class Notification
{
    public int Id { get; set; }

    public int User_Id { get; set; }

    public string Type { get; set; } = null!;

    public string Message { get; set; } = null!;

    public int? Related_Job_Id { get; set; }

    public bool Is_Read { get; set; }

    public DateTime Created_At_Utc { get; set; }

    public virtual Job? Related_Job { get; set; }

    public virtual User User { get; set; } = null!;
}
