using System;
using System.Collections.Generic;

namespace backend.Models.Entities;

public partial class Job_Image
{
    public Guid Id { get; set; }

    public Guid Job_Id { get; set; }

    public string Image_Url { get; set; } = null!;

    public string Object_Key { get; set; } = null!;

    public int Sort_Order { get; set; }

    public DateTime Created_At_Utc { get; set; }

    public virtual Job Job { get; set; } = null!;
}
