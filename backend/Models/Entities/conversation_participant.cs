using System;
using System.ComponentModel.DataAnnotations;

namespace backend.Models.Entities;

public partial class Conversation_Participant
{
    [Key]
    public Guid Id { get; set; }

    public Guid Conversation_Id { get; set; }

    public Guid User_Id { get; set; }

    // Design: user_role (e.g., 'homeowner', 'handyman', 'admin')
    public string Participant_Role { get; set; } = null!;

    public DateTime Joined_At_Utc { get; set; } = DateTime.UtcNow;

    public DateTime? Left_At_Utc { get; set; }

    public bool Is_Muted { get; set; } = false;

    public DateTime? Muted_Until_Utc { get; set; }

    public int Unread_Count { get; set; } = 0;

    public Guid? Last_Read_Message_Id { get; set; }

    // Navigation Properties
    public virtual Conversation Conversation { get; set; } = null!;
    public virtual User User { get; set; } = null!;
    public virtual Message? Last_Read_Message { get; set; }
}
