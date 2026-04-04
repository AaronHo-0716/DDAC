using System;
using System.Collections.Generic;

namespace backend.Models.Entities;

public partial class Job
{
    public int Id { get; set; }

    public int Posted_By_User_Id { get; set; }

    public string Title { get; set; } = null!;

    public string Description { get; set; } = null!;

    public string Category { get; set; } = null!;

    public string Location_Text { get; set; } = null!;

    public decimal? Latitude { get; set; }

    public decimal? Longitude { get; set; }

    public decimal? Budget { get; set; }

    public string Status { get; set; } = null!;

    public bool Is_Emergency { get; set; }

    public DateTime Created_At_Utc { get; set; }

    public DateTime Updated_At_Utc { get; set; }

    public virtual Bid? Bid { get; set; }

    public virtual ICollection<Bid_Transaction> Bid_Transactions { get; set; } = new List<Bid_Transaction>();

    public virtual ICollection<Job_Image> Job_Images { get; set; } = new List<Job_Image>();

    public virtual ICollection<Notification> Notifications { get; set; } = new List<Notification>();

    public virtual User Posted_By_User { get; set; } = null!;
}
