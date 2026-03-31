using System;
using System.Collections.Generic;

namespace backend.Models.Entities;

public partial class Refresh_Token
{
    public Guid Id { get; set; }

    public Guid User_Id { get; set; }

    public string Token_Hash { get; set; } = null!;

    public DateTime Expires_At_Utc { get; set; }

    public DateTime? Revoked_At_Utc { get; set; }

    public string? Replaced_By_Token_Hash { get; set; }

    public string? User_Agent { get; set; }

    public string? Ip_Address { get; set; }

    public DateTime Created_At_Utc { get; set; }

    public virtual User User { get; set; } = null!;
}
