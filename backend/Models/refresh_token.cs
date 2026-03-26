using System;
using System.Collections.Generic;

namespace backend.Models;

public partial class refresh_token
{
    public Guid id { get; set; }

    public Guid user_id { get; set; }

    public string token_hash { get; set; } = null!;

    public DateTime expires_at_utc { get; set; }

    public DateTime? revoked_at_utc { get; set; }

    public string? replaced_by_token_hash { get; set; }

    public string? user_agent { get; set; }

    public string? ip_address { get; set; }

    public DateTime created_at_utc { get; set; }

    public virtual user user { get; set; } = null!;
}
